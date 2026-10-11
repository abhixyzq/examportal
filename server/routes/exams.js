import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

function sanitizeExam(exam, isAdmin) {
  if (isAdmin || !exam) return exam;
  const { access_code, accessCode, ...safe } = exam;
  return safe;
}

// ── GET /api/exams ────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    if (db.isPostgres()) {
      const { rows } = await db.query('SELECT * FROM exams ORDER BY id DESC');
      return res.json(rows.map(e => sanitizeExam(e, isAdmin)));
    }
    const list = db.store.exams || [];
    res.json(list.map(e => sanitizeExam(e, isAdmin)));
  } catch (err) {
    console.error('Fetch exams error:', err);
    res.status(500).json({ error: 'Failed to retrieve exams' });
  }
});

// ── POST /api/exams (Create exam) ─────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      title, subject, duration_mins = 60, total_questions = 20,
      date, time, proctored = true, live_result = false,
      shuffle_q = true, shuffle_opt = false, max_violations = 3,
      require_code = false, access_code = ''
    } = req.body;

    if (!title || !date || !time) {
      return res.status(400).json({ error: 'Title, date, and time are required' });
    }

    const cleanAccessCode = String(access_code || '').trim().toUpperCase();

    if (db.isPostgres()) {
      const q = `
        INSERT INTO exams (title, subject, duration_mins, total_questions, date, time, status, proctored, live_result, shuffle_q, shuffle_opt, max_violations, require_code, access_code)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const { rows } = await db.query(q, [
        title, subject || 'General', Number(duration_mins), Number(total_questions),
        date, time, Boolean(proctored), Boolean(live_result), Boolean(shuffle_q), Boolean(shuffle_opt),
        Number(max_violations), Boolean(require_code), cleanAccessCode
      ]);
      return res.status(201).json(rows[0]);
    }

    const newExam = {
      id: Date.now(),
      title,
      subject: subject || 'General',
      duration_mins: Number(duration_mins),
      total_questions: Number(total_questions),
      date,
      time,
      status: 'active',
      proctored: Boolean(proctored),
      live_result: Boolean(live_result),
      shuffle_q: Boolean(shuffle_q),
      shuffle_opt: Boolean(shuffle_opt),
      max_violations: Number(max_violations),
      require_code: Boolean(require_code),
      access_code: cleanAccessCode,
    };

    if (!db.store.exams) db.store.exams = [];
    db.store.exams.unshift(newExam);
    saveLocalStore();
    res.status(201).json(newExam);
  } catch (err) {
    console.error('Create exam error:', err);
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// ── POST /api/exams/:id/verify-code ───────────────────────────────────────────
router.post('/:id/verify-code', authenticate, async (req, res) => {
  try {
    const examId = Number(req.params.id);
    const { code } = req.body;

    let exam = null;
    if (db.isPostgres()) {
      const { rows } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
      exam = rows[0];
    } else {
      exam = (db.store.exams || []).find(e => e.id === examId);
    }

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    if (!exam.require_code) {
      return res.json({ valid: true, message: 'No passcode required' });
    }

    const entered = String(code || '').trim().toUpperCase();
    const actual = String(exam.access_code || exam.accessCode || '').trim().toUpperCase();

    if (entered && entered === actual) {
      return res.json({ valid: true, message: 'Passcode verified successfully' });
    }

    res.status(400).json({ valid: false, error: 'Incorrect Exam Hall Access Code. Please ask the invigilator.' });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ error: 'Failed to verify exam access code' });
  }
});

// ── PATCH /api/exams/:id/toggle-result ────────────────────────────────────────
router.patch('/:id/toggle-result', authenticate, requireAdmin, async (req, res) => {
  try {
    const examId = Number(req.params.id);
    if (db.isPostgres()) {
      const { rows } = await db.query('UPDATE exams SET live_result = NOT live_result WHERE id = $1 RETURNING *', [examId]);
      return res.json(rows[0]);
    }
    const exam = (db.store.exams || []).find(e => e.id === examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    exam.live_result = !exam.live_result;
    saveLocalStore();
    res.json(exam);
  } catch (err) {
    console.error('Toggle live result error:', err);
    res.status(500).json({ error: 'Failed to update exam setting' });
  }
});

// ── PATCH /api/exams/:id/toggle-code ──────────────────────────────────────────
router.patch('/:id/toggle-code', authenticate, requireAdmin, async (req, res) => {
  try {
    const examId = Number(req.params.id);
    if (db.isPostgres()) {
      const { rows } = await db.query('UPDATE exams SET require_code = NOT require_code WHERE id = $1 RETURNING *', [examId]);
      return res.json(rows[0]);
    }
    const exam = (db.store.exams || []).find(e => e.id === examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    exam.require_code = !exam.require_code;
    saveLocalStore();
    res.json(exam);
  } catch (err) {
    console.error('Toggle require code error:', err);
    res.status(500).json({ error: 'Failed to update access code setting' });
  }
});

// ── DELETE /api/exams/:id ─────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const examId = Number(req.params.id);
    if (db.isPostgres()) {
      await db.query('DELETE FROM exams WHERE id = $1', [examId]);
      return res.json({ success: true });
    }
    db.store.exams = (db.store.exams || []).filter(e => e.id !== examId);
    saveLocalStore();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete exam error:', err);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

export default router;
