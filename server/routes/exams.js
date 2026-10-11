import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/exams
router.get('/', authenticate, async (req, res) => {
  try {
    if (db.isPostgres()) {
      const { rows } = await db.query('SELECT * FROM exams ORDER BY id DESC');
      return res.json(rows);
    }
    res.json(db.store.exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams (Create exam)
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

    if (db.isPostgres()) {
      const q = `
        INSERT INTO exams (title, subject, duration_mins, total_questions, date, time, status, proctored, live_result, shuffle_q, shuffle_opt, max_violations, require_code, access_code)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const { rows } = await db.query(q, [
        title, subject || 'General', duration_mins, total_questions,
        date, time, proctored, live_result, shuffle_q, shuffle_opt,
        max_violations, require_code, access_code.toUpperCase()
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
      access_code: (access_code || '').toUpperCase(),
    };

    db.store.exams.unshift(newExam);
    saveLocalStore();
    res.status(201).json(newExam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams/:id/verify-code (Verify Exam Hall Access Code)
router.post('/:id/verify-code', authenticate, async (req, res) => {
  try {
    const examId = parseInt(req.params.id);
    const { code } = req.body;

    let exam = null;
    if (db.isPostgres()) {
      const { rows } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
      exam = rows[0];
    } else {
      exam = db.store.exams.find(e => e.id === examId);
    }

    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    if (!exam.require_code && !exam.requireCode) {
      return res.json({ success: true, message: 'No access code required for this exam' });
    }

    const targetCode = (exam.access_code || exam.accessCode || '').trim().toUpperCase();
    const inputCode = (code || '').trim().toUpperCase();

    if (targetCode && inputCode === targetCode) {
      return res.json({ success: true, verified: true });
    }

    res.status(403).json({ success: false, error: 'Invalid Hall Access Code' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/exams/:id/toggle-result
router.patch('/:id/toggle-result', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (db.isPostgres()) {
      const { rows } = await db.query('UPDATE exams SET live_result = NOT live_result WHERE id = $1 RETURNING *', [id]);
      return res.json(rows[0]);
    }
    const ex = db.store.exams.find(e => e.id === id);
    if (ex) {
      ex.live_result = !ex.live_result;
      if (ex.liveResult !== undefined) ex.liveResult = ex.live_result;
      saveLocalStore();
      return res.json(ex);
    }
    res.status(404).json({ error: 'Exam not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/exams/:id/toggle-code
router.patch('/:id/toggle-code', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (db.isPostgres()) {
      const { rows } = await db.query('UPDATE exams SET require_code = NOT require_code WHERE id = $1 RETURNING *', [id]);
      return res.json(rows[0]);
    }
    const ex = db.store.exams.find(e => e.id === id);
    if (ex) {
      ex.require_code = !ex.require_code;
      if (ex.requireCode !== undefined) ex.requireCode = ex.require_code;
      saveLocalStore();
      return res.json(ex);
    }
    res.status(404).json({ error: 'Exam not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exams/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (db.isPostgres()) {
      await db.query('DELETE FROM exams WHERE id = $1', [id]);
      return res.json({ success: true });
    }
    db.store.exams = db.store.exams.filter(e => e.id !== id);
    saveLocalStore();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
