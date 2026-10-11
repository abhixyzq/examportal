import { Router } from 'express';
import { db, ensureSchema } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// In-memory active students map for fast serverless roster state
// Key: `${examId}_${studentId}`
if (!global.__activeStudents) {
  global.__activeStudents = new Map();
}
const activeStudents = global.__activeStudents;

// POST /api/monitor/heartbeat
router.post('/heartbeat', authenticate, async (req, res) => {
  try {
    const { examId, answered = 0, timeLeft = '00:00', total = 20 } = req.body;
    const studentId = req.user.id;
    const key = `${examId}_${studentId}`;

    const existing = activeStudents.get(key) || {
      id: studentId,
      name: req.user.name || 'Student',
      email: req.user.email || '',
      rollNo: req.user.roll_no || 'N/A',
      examId,
      violations: 0,
      recentViolation: null,
      status: 'active',
    };

    activeStudents.set(key, {
      ...existing,
      answered,
      timeLeft,
      total,
      lastHeartbeat: Date.now(),
      status: existing.status === 'disqualified' ? 'disqualified' : 'active',
    });

    res.json({
      status: existing.status,
      disqualified: existing.status === 'disqualified',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/monitor/violation
router.post('/violation', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const { examId, violationType, count } = req.body;
    const studentId = req.user.id;
    const key = `${examId}_${studentId}`;

    const current = activeStudents.get(key) || {
      id: studentId,
      name: req.user.name || 'Student',
      email: req.user.email || '',
      rollNo: req.user.roll_no || 'N/A',
      examId,
      answered: 0,
      timeLeft: '00:00',
      total: 20,
      status: 'active',
    };

    const newViolations = typeof count === 'number' ? count : (current.violations + 1);
    const isAutoDisqualified = newViolations >= 3;

    activeStudents.set(key, {
      ...current,
      violations: newViolations,
      recentViolation: violationType,
      lastHeartbeat: Date.now(),
      status: isAutoDisqualified ? 'disqualified' : current.status,
    });

    if (db.isPostgres()) {
      try {
        await db.query(
          'INSERT INTO violations_log (exam_id, user_id, violation_type) VALUES ($1, $2, $3)',
          [examId, studentId, violationType]
        );
      } catch (err) {
        console.warn('Postgres violation insert warning:', err.message);
      }
    }

    res.json({
      violations: newViolations,
      disqualified: isAutoDisqualified,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/monitor/live (Admin fetch active live students)
router.get('/live', authenticate, requireAdmin, (req, res) => {
  try {
    const examId = Number(req.query.examId) || 2;
    const now = Date.now();
    const result = [];

    for (const [key, student] of activeStudents.entries()) {
      if (Number(student.examId) === examId) {
        // If no heartbeat for > 45 seconds, mark as reconnecting/idle
        const isOffline = (now - student.lastHeartbeat) > 45000;
        result.push({
          ...student,
          status: student.status === 'disqualified'
            ? 'disqualified'
            : (isOffline ? 'offline' : student.status),
        });
      }
    }

    res.json({
      examId,
      count: result.length,
      students: result,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/monitor/disqualify (Admin manually disqualifies a student)
router.post('/disqualify', authenticate, requireAdmin, (req, res) => {
  try {
    const { examId, studentId } = req.body;
    const key = `${examId}_${studentId}`;
    const student = activeStudents.get(key);

    if (student) {
      student.status = 'disqualified';
      activeStudents.set(key, student);
    }

    res.json({ success: true, message: 'Student disqualified' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/monitor/status (Student checks if invigilator has sent a command)
router.get('/status', authenticate, (req, res) => {
  try {
    const examId = Number(req.query.examId);
    const studentId = req.user.id;
    const key = `${examId}_${studentId}`;
    const student = activeStudents.get(key);

    res.json({
      disqualified: student?.status === 'disqualified',
      status: student?.status || 'active',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
