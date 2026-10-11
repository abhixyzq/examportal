import { Router } from 'express';
import { db, ensureSchema } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/questions
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    if (db.isPostgres()) {
      const { rows } = await db.query('SELECT * FROM questions ORDER BY id DESC');
      return res.json(rows);
    }
    res.json(db.store.questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions (Add single question)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const { text, optA, optB, optC, optD, correct, subject, difficulty } = req.body;
    if (!text || !optA || !optB || !optC || !optD || !correct) {
      return res.status(400).json({ error: 'Question text, 4 options, and correct answer are required' });
    }

    if (db.isPostgres()) {
      const q = `
        INSERT INTO questions (text, opt_a, opt_b, opt_c, opt_d, correct, subject, difficulty)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const { rows } = await db.query(q, [text, optA, optB, optC, optD, correct, subject || 'General', difficulty || 'easy']);
      return res.status(201).json(rows[0]);
    }

    const newQ = {
      id: Date.now(),
      text,
      optA,
      optB,
      optC,
      optD,
      correct,
      subject: subject || 'General',
      difficulty: difficulty || 'easy',
    };
    db.store.questions.unshift(newQ);
    res.status(201).json(newQ);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions/bulk (Bulk import questions)
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Array of questions is required' });
    }

    if (db.isPostgres()) {
      const inserted = [];
      for (const q of questions) {
        const ins = await db.query(`
          INSERT INTO questions (text, opt_a, opt_b, opt_c, opt_d, correct, subject, difficulty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [
          q.text,
          q.optA || q.opt_a,
          q.optB || q.opt_b,
          q.optC || q.opt_c,
          q.optD || q.opt_d,
          q.correct,
          q.subject || 'General',
          q.difficulty || 'easy'
        ]);
        inserted.push(ins.rows[0]);
      }
      return res.status(201).json({ count: inserted.length, questions: inserted });
    }

    const added = questions.map((q, idx) => ({
      id: Date.now() + idx,
      text: q.text,
      optA: q.optA || q.opt_a,
      optB: q.optB || q.opt_b,
      optC: q.optC || q.opt_c,
      optD: q.optD || q.opt_d,
      correct: q.correct,
      subject: q.subject || 'General',
      difficulty: q.difficulty || 'easy',
    }));

    db.store.questions.unshift(...added);
    res.status(201).json({ count: added.length, questions: added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/questions/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const qId = Number(req.params.id);
    if (db.isPostgres()) {
      await db.query('DELETE FROM questions WHERE id = $1', [qId]);
      return res.json({ success: true });
    }
    db.store.questions = db.store.questions.filter(q => q.id !== qId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
