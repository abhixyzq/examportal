// Real-Time Socket.io Proctoring Engine for 500 concurrent students

export function setupMonitorSockets(io) {
  // Key: examId -> Map of studentId -> studentState
  const activeExams = new Map();

  function getExamSession(examId) {
    if (!activeExams.has(examId)) {
      activeExams.set(examId, new Map());
    }
    return activeExams.get(examId);
  }

  io.on('connection', (socket) => {
    let currentStudent = null;
    let currentExamId = null;

    // 1. Student joins active exam session
    socket.on('student:join', (data) => {
      const { examId, studentId, name, email, totalQuestions } = data;
      currentExamId = examId;
      currentStudent = {
        socketId: socket.id,
        id: studentId,
        name: name || `Student #${studentId}`,
        email: email || '',
        answered: 0,
        total: totalQuestions || 20,
        violations: 0,
        lastViolation: null,
        timeLeft: '60:00',
        status: 'active', // active | warning | danger | disconnected
        lastHeartbeat: Date.now()
      };

      const session = getExamSession(examId);
      session.set(studentId, currentStudent);

      socket.join(`exam:${examId}`);

      // Broadcast updated student roster to admins
      io.to(`admin:monitor:${examId}`).emit('monitor:update', {
        type: 'student_joined',
        student: currentStudent,
        totalActive: session.size
      });
    });

    // 2. Periodic heartbeat from student client (every 10-15s)
    socket.on('student:heartbeat', (data) => {
      const { examId, studentId, answered, timeLeft } = data;
      const session = getExamSession(examId);
      const student = session.get(studentId);

      if (student) {
        student.answered = answered ?? student.answered;
        student.timeLeft = timeLeft ?? student.timeLeft;
        student.lastHeartbeat = Date.now();

        io.to(`admin:monitor:${examId}`).emit('monitor:heartbeat', {
          studentId,
          answered: student.answered,
          timeLeft: student.timeLeft
        });
      }
    });

    // 3. Proctoring violation detected on student client
    socket.on('student:violation', (data) => {
      const { examId, studentId, violationType, count } = data;
      const session = getExamSession(examId);
      const student = session.get(studentId);

      if (student) {
        student.violations = count || (student.violations + 1);
        student.lastViolation = {
          type: violationType,
          time: new Date().toLocaleTimeString()
        };

        if (student.violations >= 3) {
          student.status = 'danger';
        } else if (student.violations > 0) {
          student.status = 'warning';
        }

        // Notify admins instantly
        io.to(`admin:monitor:${examId}`).emit('monitor:violation', {
          studentId,
          violations: student.violations,
          violationType,
          status: student.status,
          time: student.lastViolation.time
        });
      }
    });

    // 4. Admin joins live monitor room
    socket.on('admin:subscribe', (data) => {
      const { examId } = data;
      socket.join(`admin:monitor:${examId}`);

      const session = getExamSession(examId);
      const studentsList = Array.from(session.values());

      // Send current live state immediately
      socket.emit('monitor:init', {
        examId,
        students: studentsList,
        totalActive: studentsList.length
      });
    });

    // 5. Admin remotely terminates/submits student
    socket.on('admin:terminate', (data) => {
      const { examId, studentId, reason } = data;
      const session = getExamSession(examId);
      const student = session.get(studentId);

      if (student && student.socketId) {
        io.to(student.socketId).emit('exam:terminated', {
          reason: reason || 'Terminated by Exam Invigilator'
        });
        student.status = 'danger';
        io.to(`admin:monitor:${examId}`).emit('monitor:update', {
          type: 'student_terminated',
          studentId
        });
      }
    });

    // 6. Handle disconnects
    socket.on('disconnect', () => {
      if (currentExamId && currentStudent) {
        const session = getExamSession(currentExamId);
        const student = session.get(currentStudent.id);
        if (student) {
          student.status = 'disconnected';
          io.to(`admin:monitor:${currentExamId}`).emit('monitor:update', {
            type: 'student_disconnected',
            studentId: currentStudent.id
          });
        }
      }
    });
  });

  // Background cleanup for inactive stale sessions
  setInterval(() => {
    const now = Date.now();
    for (const [examId, session] of activeExams.entries()) {
      for (const [studentId, student] of session.entries()) {
        if (now - student.lastHeartbeat > 45000 && student.status !== 'disconnected') {
          student.status = 'disconnected';
          io.to(`admin:monitor:${examId}`).emit('monitor:update', {
            type: 'student_disconnected',
            studentId
          });
        }
      }
    }
  }, 15000);
}
