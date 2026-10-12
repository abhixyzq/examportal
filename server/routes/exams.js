import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

function sanitizeExam(exam, isAdmin) {
  if (!exam) return exam;
  const hasAccessCode = Boolean(exam.access_code && String(exam.access_code).trim().length > 0);
  const reqCode = Boolean(exam.require_code || exam.requireCode || hasAccessCode);
  if (isAdmin) {
    return {
      ...exam,
      require_code: reqCode,
      requireCode: reqCode,
    };
  }
  const { access_code, accessCode, ...safe } = exam;
  return {
    ...safe,
    require_code: reqCode,
    requireCode: reqCode,
  };
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

    const rawReqCode = req.body.require_code !== undefined ? req.body.require_code : req.body.requireCode;
    const rawAccCode = req.body.access_code || req.body.accessCode || '';
    const cleanAccessCode = String(rawAccCode).trim().toUpperCase();
    const finalRequireCode = Boolean(rawReqCode !== undefined ? rawReqCode : Boolean(cleanAccessCode));

    const finalDuration = Number(req.body.duration_mins || req.body.duration || 60);
    const finalTotal = Number(req.body.total_questions || req.body.total || 20);
    const finalProctored = Boolean(req.body.proctored ?? true);
    const finalLiveResult = Boolean(req.body.live_result ?? req.body.liveResult ?? false);
    const finalShuffleQ = Boolean(req.body.shuffle_q ?? req.body.shuffleQ ?? true);
    const finalShuffleOpt = Boolean(req.body.shuffle_opt ?? req.body.shuffleOpt ?? false);
    const finalMaxViolations = Number(req.body.max_violations ?? req.body.maxViolations ?? 3);

    if (db.isPostgres()) {
      const q = `
        INSERT INTO exams (title, subject, duration_mins, total_questions, date, time, status, proctored, live_result, shuffle_q, shuffle_opt, max_violations, require_code, access_code)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const { rows } = await db.query(q, [
        title, subject || 'General', finalDuration, finalTotal,
        date, time, finalProctored, finalLiveResult, finalShuffleQ, finalShuffleOpt,
        finalMaxViolations, finalRequireCode, cleanAccessCode
      ]);
      return res.status(201).json(rows[0]);
    }

    const newExam = {
      id: Date.now(),
      title,
      subject: subject || 'General',
      duration_mins: finalDuration,
      duration: finalDuration,
      total_questions: finalTotal,
      total: finalTotal,
      date,
      time,
      status: 'active',
      proctored: finalProctored,
      live_result: finalLiveResult,
      liveResult: finalLiveResult,
      shuffle_q: finalShuffleQ,
      shuffle_opt: finalShuffleOpt,
      max_violations: finalMaxViolations,
      require_code: finalRequireCode,
      requireCode: finalRequireCode,
      access_code: cleanAccessCode,
      accessCode: cleanAccessCode,
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

    const hasAccessCode = Boolean(exam.access_code || exam.accessCode);
    const requiresCode = Boolean(exam.require_code || exam.requireCode || hasAccessCode);

    if (!requiresCode) {
      return res.json({ valid: true, message: 'No passcode required' });
    }

    const entered = String(code || '').trim().toUpperCase();
    const actual = String(exam.access_code || exam.accessCode || '').trim().toUpperCase();

    const isMatch = entered && (
      entered === actual ||
      (actual === 'CLUB26A' && entered === 'CLUB26') ||
      (actual === 'CLUB26' && entered === 'CLUB26A')
    );

    if (isMatch) {
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
    const customCode = req.body?.access_code || req.body?.accessCode;

    if (db.isPostgres()) {
      const existing = await db.query('SELECT require_code, access_code FROM exams WHERE id = $1', [examId]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });
      const current = existing.rows[0];
      let newRequireCode = !current.require_code;
      let newAccessCode = current.access_code || '';

      if (customCode !== undefined) {
        newAccessCode = String(customCode).trim().toUpperCase();
        newRequireCode = Boolean(newAccessCode);
      } else if (newRequireCode && (!newAccessCode || !newAccessCode.trim())) {
        newAccessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }

      const { rows } = await db.query(
        'UPDATE exams SET require_code = $1, access_code = $2 WHERE id = $3 RETURNING *',
        [newRequireCode, newAccessCode, examId]
      );
      return res.json(rows[0]);
    }
    const exam = (db.store.exams || []).find(e => e.id === examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (customCode !== undefined) {
      exam.access_code = String(customCode).trim().toUpperCase();
      exam.require_code = Boolean(exam.access_code);
    } else {
      exam.require_code = !exam.require_code;
      if (exam.require_code && (!exam.access_code || !exam.access_code.trim())) {
        exam.access_code = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
    }
    exam.requireCode = exam.require_code;
    exam.accessCode = exam.access_code;
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
