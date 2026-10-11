import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/questions
router.get('/', authenticate, async (req, res) => {
  try {
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
    saveLocalStore();
    res.status(201).json(newQ);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions/bulk (Bulk import from CSV or array)
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Array of questions required' });
    }

    if (db.isPostgres()) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = [];
        for (const q of questions) {
          const resQ = await client.query(
            `INSERT INTO questions (text, opt_a, opt_b, opt_c, opt_d, correct, subject, difficulty)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [q.text, q.optA, q.optB, q.optC, q.optD, q.correct, q.subject || 'General', q.difficulty || 'easy']
          );
          inserted.push(resQ.rows[0]);
        }
        await client.query('COMMIT');
        return res.status(201).json({ count: inserted.length, items: inserted });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const newItems = questions.map((q, idx) => ({
      id: Date.now() + idx,
      text: q.text,
      optA: q.optA,
      optB: q.optB,
      optC: q.optC,
      optD: q.optD,
      correct: q.correct,
      subject: q.subject || 'General',
      difficulty: q.difficulty || 'easy',
    }));

    db.store.questions.unshift(...newItems);
    saveLocalStore();
    res.status(201).json({ count: newItems.length, items: newItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/questions/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (db.isPostgres()) {
      await db.query('DELETE FROM questions WHERE id = $1', [id]);
      return res.json({ success: true });
    }
    db.store.questions = db.store.questions.filter(q => q.id !== id);
    saveLocalStore();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
