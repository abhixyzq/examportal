import { Router } from 'express';
import { db, ensureSchema } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

function formatQuestion(q) {
  let opts = q.options;
  if (typeof opts === 'string') {
    try { opts = JSON.parse(opts); } catch { opts = null; }
  }
  if (!Array.isArray(opts) || opts.length === 0) {
    opts = [q.opt_a || q.optA, q.opt_b || q.optB, q.opt_c || q.optC, q.opt_d || q.optD].filter(Boolean);
  }
  const isMulti = String(q.correct || '').includes(',') || (Array.isArray(q.correct) && q.correct.length > 1);
  return {
    ...q,
    options: opts,
    isMulti,
  };
}

// GET /api/questions
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const examId = req.query.examId || req.query.exam_id;
    if (db.isPostgres()) {
      if (examId) {
        const { rows } = await db.query(
          'SELECT * FROM questions WHERE exam_id = $1 ORDER BY id ASC',
          [Number(examId)]
        );
        return res.json(rows.map(formatQuestion));
      }
      const { rows } = await db.query('SELECT * FROM questions ORDER BY id DESC');
      return res.json(rows.map(formatQuestion));
    }
    let list = db.store.questions || [];
    if (examId) {
      list = list.filter(q => Number(q.exam_id || q.examId) === Number(examId));
    }
    res.json(list.map(formatQuestion));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions (Add single question)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const { text, options, optA, optB, optC, optD, correct, subject, exam_id, examId } = req.body;
    
    // Normalize options array
    let optionsList = [];
    if (Array.isArray(options) && options.length > 0) {
      optionsList = options.map(o => String(o).trim()).filter(Boolean);
    } else {
      optionsList = [optA, optB, optC, optD].map(o => (o ? String(o).trim() : '')).filter(Boolean);
    }

    if (!text || optionsList.length < 2) {
      return res.status(400).json({ error: 'Question text and at least 2 options are required' });
    }

    // Normalize correct answer(s)
    let correctStr = '';
    if (Array.isArray(correct)) {
      correctStr = correct.map(c => String(c).trim().toUpperCase()).filter(Boolean).sort().join(',');
    } else if (typeof correct === 'string') {
      correctStr = correct.split(',').map(c => c.trim().toUpperCase()).filter(Boolean).sort().join(',');
    }
    if (!correctStr) {
      return res.status(400).json({ error: 'At least one correct answer must be selected' });
    }

    const finalExamId = exam_id || examId ? Number(exam_id || examId) : null;
    const opt_a = optionsList[0] || '';
    const opt_b = optionsList[1] || '';
    const opt_c = optionsList[2] || '';
    const opt_d = optionsList[3] || '';

    if (db.isPostgres()) {
      const q = `
        INSERT INTO questions (exam_id, text, options, opt_a, opt_b, opt_c, opt_d, correct, subject)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const { rows } = await db.query(q, [
        finalExamId,
        text,
        JSON.stringify(optionsList),
        opt_a,
        opt_b,
        opt_c,
        opt_d,
        correctStr,
        subject || 'General'
      ]);
      return res.status(201).json(formatQuestion(rows[0]));
    }

    const newQ = {
      id: Date.now(),
      exam_id: finalExamId,
      text,
      options: optionsList,
      optA: opt_a,
      optB: opt_b,
      optC: opt_c,
      optD: opt_d,
      correct: correctStr,
      subject: subject || 'General',
    };
    db.store.questions.unshift(newQ);
    res.status(201).json(formatQuestion(newQ));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions/bulk (Bulk import questions)
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const { questions, exam_id, examId } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Array of questions is required' });
    }
    const defaultExamId = exam_id || examId ? Number(exam_id || examId) : null;

    if (db.isPostgres()) {
      const inserted = [];
      for (const q of questions) {
        const itemExamId = q.exam_id || q.examId ? Number(q.exam_id || q.examId) : defaultExamId;
        
        let optionsList = [];
        if (Array.isArray(q.options) && q.options.length > 0) {
          optionsList = q.options.map(o => String(o).trim()).filter(Boolean);
        } else {
          optionsList = [q.optA || q.opt_a, q.optB || q.opt_b, q.optC || q.opt_c, q.optD || q.opt_d].map(o => (o ? String(o).trim() : '')).filter(Boolean);
        }

        let correctStr = '';
        if (Array.isArray(q.correct)) {
          correctStr = q.correct.map(c => String(c).trim().toUpperCase()).filter(Boolean).sort().join(',');
        } else if (typeof q.correct === 'string') {
          correctStr = q.correct.split(',').map(c => c.trim().toUpperCase()).filter(Boolean).sort().join(',');
        }

        const ins = await db.query(`
          INSERT INTO questions (exam_id, text, options, opt_a, opt_b, opt_c, opt_d, correct, subject)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          itemExamId,
          q.text,
          JSON.stringify(optionsList),
          optionsList[0] || '',
          optionsList[1] || '',
          optionsList[2] || '',
          optionsList[3] || '',
          correctStr || 'A',
          q.subject || 'General'
        ]);
        inserted.push(formatQuestion(ins.rows[0]));
      }
      return res.status(201).json({ count: inserted.length, questions: inserted });
    }

    const added = questions.map((q, idx) => {
      let optionsList = [];
      if (Array.isArray(q.options) && q.options.length > 0) {
        optionsList = q.options.map(o => String(o).trim()).filter(Boolean);
      } else {
        optionsList = [q.optA || q.opt_a, q.optB || q.opt_b, q.optC || q.opt_c, q.optD || q.opt_d].map(o => (o ? String(o).trim() : '')).filter(Boolean);
      }

      let correctStr = '';
      if (Array.isArray(q.correct)) {
        correctStr = q.correct.map(c => String(c).trim().toUpperCase()).filter(Boolean).sort().join(',');
      } else if (typeof q.correct === 'string') {
        correctStr = q.correct.split(',').map(c => c.trim().toUpperCase()).filter(Boolean).sort().join(',');
      }

      return {
        id: Date.now() + idx,
        exam_id: q.exam_id || q.examId ? Number(q.exam_id || q.examId) : defaultExamId,
        text: q.text,
        options: optionsList,
        optA: optionsList[0] || '',
        optB: optionsList[1] || '',
        optC: optionsList[2] || '',
        optD: optionsList[3] || '',
        correct: correctStr || 'A',
        subject: q.subject || 'General',
      };
    });

    db.store.questions.unshift(...added);
    res.status(201).json({ count: added.length, questions: added.map(formatQuestion) });
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
