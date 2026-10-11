// Real-Time Socket.io Proctoring Engine for up to 500+ concurrent students

export function setupMonitorSockets(io) {
  // Key: examId -> Map of studentId -> studentState
  const activeExams = new Map();

  function getExamSession(examId) {
    const key = String(examId);
    if (!activeExams.has(key)) {
      activeExams.set(key, new Map());
    }
    return activeExams.get(key);
  }

  io.on('connection', (socket) => {
    let currentStudent = null;
    let currentExamId = null;

    // 1. Student joins active exam session
    socket.on('student:join', (data) => {
      try {
        if (!data || !data.examId || !data.studentId) return;
        const { examId, studentId, name, email, totalQuestions } = data;
        currentExamId = String(examId);

        currentStudent = {
          socketId: socket.id,
          id: studentId,
          name: name ? String(name).slice(0, 100) : `Student #${studentId}`,
          email: email ? String(email).slice(0, 100) : '',
          answered: 0,
          total: Number(totalQuestions) || 20,
          violations: 0,
          lastViolation: null,
          timeLeft: '60:00',
          status: 'active', // active | warning | danger | disconnected
          lastHeartbeat: Date.now(),
        };

        const session = getExamSession(currentExamId);
        session.set(studentId, currentStudent);

        socket.join(`exam:${currentExamId}`);

        // Broadcast updated student roster to invigilators
        io.to(`admin:monitor:${currentExamId}`).emit('monitor:update', {
          type: 'student_joined',
          student: currentStudent,
          totalActive: session.size,
        });
      } catch (err) {
        console.error('Socket student:join error:', err.message);
      }
    });

    // 2. Periodic heartbeat from student client (every 10-15s)
    socket.on('student:heartbeat', (data) => {
      try {
        if (!data || !data.examId || !data.studentId) return;
        const { examId, studentId, answered, timeLeft } = data;
        const session = getExamSession(examId);
        const student = session.get(studentId);

        if (student) {
          student.answered = answered !== undefined ? Number(answered) : student.answered;
          student.timeLeft = timeLeft ? String(timeLeft).slice(0, 10) : student.timeLeft;
          student.lastHeartbeat = Date.now();
          if (student.status === 'disconnected') {
            student.status = student.violations >= 3 ? 'danger' : (student.violations > 0 ? 'warning' : 'active');
          }

          io.to(`admin:monitor:${examId}`).emit('monitor:heartbeat', {
            studentId,
            answered: student.answered,
            timeLeft: student.timeLeft,
            status: student.status,
          });
        }
      } catch (err) {
        console.error('Socket heartbeat error:', err.message);
      }
    });

    // 3. Proctoring violation detected on student client
    socket.on('student:violation', (data) => {
      try {
        if (!data || !data.examId || !data.studentId) return;
        const { examId, studentId, violationType, count } = data;
        const session = getExamSession(examId);
        const student = session.get(studentId);

        if (student) {
          student.violations = typeof count === 'number' ? count : (student.violations + 1);
          student.lastViolation = {
            type: String(violationType || 'unknown').slice(0, 50),
            time: new Date().toLocaleTimeString(),
          };

          if (student.violations >= 3) {
            student.status = 'danger';
          } else if (student.violations > 0) {
            student.status = 'warning';
          }

          // Notify admins immediately
          io.to(`admin:monitor:${examId}`).emit('monitor:violation', {
            studentId,
            violations: student.violations,
            violationType: student.lastViolation.type,
            status: student.status,
            time: student.lastViolation.time,
          });
        }
      } catch (err) {
        console.error('Socket violation error:', err.message);
      }
    });

    // 4. Admin joins live monitor room
    socket.on('admin:subscribe', (data) => {
      try {
        if (!data || !data.examId) return;
        const { examId } = data;
        socket.join(`admin:monitor:${examId}`);

        const session = getExamSession(examId);
        const studentsList = Array.from(session.values());

        // Send current live state immediately
        socket.emit('monitor:init', {
          examId,
          students: studentsList,
          totalActive: studentsList.length,
        });
      } catch (err) {
        console.error('Socket admin:subscribe error:', err.message);
      }
    });

    // 5. Admin remotely terminates student
    socket.on('admin:terminate', (data) => {
      try {
        if (!data || !data.examId || !data.studentId) return;
        const { examId, studentId, reason } = data;
        const session = getExamSession(examId);
        const student = session.get(studentId);

        if (student && student.socketId) {
          io.to(student.socketId).emit('exam:terminated', {
            reason: reason || 'Terminated by Exam Invigilator',
          });
          student.status = 'danger';
          io.to(`admin:monitor:${examId}`).emit('monitor:update', {
            type: 'student_terminated',
            studentId,
          });
        }
      } catch (err) {
        console.error('Socket admin:terminate error:', err.message);
      }
    });

    // 6. Handle client disconnect
    socket.on('disconnect', () => {
      try {
        if (currentExamId && currentStudent) {
          const session = getExamSession(currentExamId);
          const student = session.get(currentStudent.id);
          if (student) {
            student.status = 'disconnected';
            io.to(`admin:monitor:${currentExamId}`).emit('monitor:update', {
              type: 'student_disconnected',
              studentId: currentStudent.id,
            });
          }
        }
      } catch (err) {
        console.error('Socket disconnect handler error:', err.message);
      }
    });
  });

  // Background cleanup: mark inactive and reclaim stale session memory
  setInterval(() => {
    try {
      const now = Date.now();
      for (const [examId, session] of activeExams.entries()) {
        for (const [studentId, student] of session.entries()) {
          // If no heartbeat for > 45s, mark disconnected
          if (now - student.lastHeartbeat > 45000 && student.status !== 'disconnected') {
            student.status = 'disconnected';
            io.to(`admin:monitor:${examId}`).emit('monitor:update', {
              type: 'student_disconnected',
              studentId,
            });
          }

          // If disconnected for more than 30 minutes, purge from memory
          if (now - student.lastHeartbeat > 1800000) {
            session.delete(studentId);
          }
        }

        // Clean up empty exam rooms
        if (session.size === 0) {
          activeExams.delete(examId);
        }
      }
    } catch (err) {
      console.error('Socket monitor cleanup interval error:', err.message);
    }
  }, 15000);
}
