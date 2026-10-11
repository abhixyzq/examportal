import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/questions
router.get('/', authenticate, async (req, res) => {
  try {
    const examId = req.query.examId || req.query.exam_id;
    if (db.isPostgres()) {
      if (examId) {
        const { rows } = await db.query(
          'SELECT * FROM questions WHERE exam_id = $1 ORDER BY id ASC',
          [Number(examId)]
        );
        return res.json(rows);
      }
      const { rows } = await db.query('SELECT * FROM questions ORDER BY id DESC');
      return res.json(rows);
    }
    if (examId) {
      return res.json(db.store.questions.filter(q => Number(q.exam_id || q.examId) === Number(examId)));
    }
    res.json(db.store.questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions (Add single question)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { text, optA, optB, optC, optD, correct, subject, difficulty, exam_id, examId } = req.body;
    if (!text || !optA || !optB || !optC || !optD || !correct) {
      return res.status(400).json({ error: 'Question text, 4 options, and correct answer are required' });
    }
    const finalExamId = exam_id || examId ? Number(exam_id || examId) : null;

    if (db.isPostgres()) {
      const q = `
        INSERT INTO questions (exam_id, text, opt_a, opt_b, opt_c, opt_d, correct, subject, difficulty)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const { rows } = await db.query(q, [finalExamId, text, optA, optB, optC, optD, correct, subject || 'General', difficulty || 'easy']);
      return res.status(201).json(rows[0]);
    }

    const newQ = {
      id: Date.now(),
      exam_id: finalExamId,
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
    const { questions, exam_id, examId } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Array of questions required' });
    }
    const defaultExamId = exam_id || examId ? Number(exam_id || examId) : null;

    if (db.isPostgres()) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = [];
        for (const q of questions) {
          const itemExamId = q.exam_id || q.examId ? Number(q.exam_id || q.examId) : defaultExamId;
          const resQ = await client.query(
            `INSERT INTO questions (exam_id, text, opt_a, opt_b, opt_c, opt_d, correct, subject, difficulty)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [itemExamId, q.text, q.optA || q.opt_a, q.optB || q.opt_b, q.optC || q.opt_c, q.optD || q.opt_d, q.correct, q.subject || 'General', q.difficulty || 'easy']
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
      exam_id: q.exam_id || q.examId ? Number(q.exam_id || q.examId) : defaultExamId,
      text: q.text,
      optA: q.optA || q.opt_a,
      optB: q.optB || q.opt_b,
      optC: q.optC || q.opt_c,
      optD: q.optD || q.opt_d,
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
