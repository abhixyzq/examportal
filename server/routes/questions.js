import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── Shared Helpers ────────────────────────────────────────────────────────────
export function normalizeOptions(options, optA, optB, optC, optD) {
  if (Array.isArray(options) && options.length > 0) {
    return options.map(o => String(o ?? '').trim()).filter(Boolean);
  }
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(o => String(o ?? '').trim()).filter(Boolean);
      }
    } catch {
      // not JSON string
    }
  }
  return [optA, optB, optC, optD].map(o => (o ? String(o).trim() : '')).filter(Boolean);
}

export function normalizeCorrect(correct) {
  if (Array.isArray(correct)) {
    return correct.map(c => String(c).trim().toUpperCase()).filter(Boolean).sort().join(',');
  }
  if (typeof correct === 'string') {
    return correct.split(',').map(c => c.trim().toUpperCase()).filter(Boolean).sort().join(',');
  }
  return '';
}

export function formatQuestion(q) {
  const opts = normalizeOptions(q.options, q.opt_a || q.optA, q.opt_b || q.optB, q.opt_c || q.optC, q.opt_d || q.optD);
  const correctStr = normalizeCorrect(q.correct);
  const isMulti = correctStr.includes(',');

  return {
    id: q.id,
    exam_id: q.exam_id !== undefined ? q.exam_id : (q.examId !== undefined ? q.examId : null),
    text: q.text,
    options: opts,
    optA: opts[0] || '',
    optB: opts[1] || '',
    optC: opts[2] || '',
    optD: opts[3] || '',
    correct: correctStr,
    subject: q.subject || 'General',
    isMulti,
  };
}

// ── GET /api/questions ────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const examId = req.query.examId || req.query.exam_id;
    const numExamId = examId ? Number(examId) : null;

    if (db.isPostgres()) {
      if (numExamId) {
        const { rows } = await db.query(
          'SELECT * FROM questions WHERE exam_id = $1 ORDER BY id ASC',
          [numExamId]
        );
        return res.json(rows.map(formatQuestion));
      }
      const { rows } = await db.query('SELECT * FROM questions ORDER BY id DESC');
      return res.json(rows.map(formatQuestion));
    }

    let list = db.store.questions || [];
    if (numExamId) {
      list = list.filter(q => Number(q.exam_id || q.examId) === numExamId);
    }
    res.json(list.map(formatQuestion));
  } catch (err) {
    console.error('Fetch questions error:', err);
    res.status(500).json({ error: 'Failed to retrieve questions' });
  }
});

// ── POST /api/questions (Add single question) ─────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { text, options, optA, optB, optC, optD, correct, subject, exam_id, examId } = req.body;

    const optionsList = normalizeOptions(options, optA, optB, optC, optD);
    if (!text || !text.trim() || optionsList.length < 2) {
      return res.status(400).json({ error: 'Question text and at least 2 options are required' });
    }

    const correctStr = normalizeCorrect(correct);
    if (!correctStr) {
      return res.status(400).json({ error: 'At least one correct answer is required' });
    }

    const finalExamId = (exam_id || examId) ? Number(exam_id || examId) : null;
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
        text.trim(),
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
      text: text.trim(),
      options: optionsList,
      optA: opt_a,
      optB: opt_b,
      optC: opt_c,
      optD: opt_d,
      correct: correctStr,
      subject: subject || 'General',
    };

    if (!db.store.questions) db.store.questions = [];
    db.store.questions.unshift(newQ);
    saveLocalStore();
    res.status(201).json(formatQuestion(newQ));
  } catch (err) {
    console.error('Create question error:', err);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// ── POST /api/questions/bulk (Bulk import from CSV or array) ──────────────────
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { questions, exam_id, examId } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Array of questions required' });
    }
    const defaultExamId = (exam_id || examId) ? Number(exam_id || examId) : null;

    const validQuestions = [];
    for (const q of questions) {
      if (!q.text || !String(q.text).trim()) continue;
      const optionsList = normalizeOptions(q.options, q.optA || q.opt_a, q.optB || q.opt_b, q.optC || q.opt_c, q.optD || q.opt_d);
      if (optionsList.length < 2) continue;
      const correctStr = normalizeCorrect(q.correct) || 'A';
      const itemExamId = (q.exam_id || q.examId) ? Number(q.exam_id || q.examId) : defaultExamId;

      validQuestions.push({
        exam_id: itemExamId,
        text: String(q.text).trim(),
        options: optionsList,
        opt_a: optionsList[0] || '',
        opt_b: optionsList[1] || '',
        opt_c: optionsList[2] || '',
        opt_d: optionsList[3] || '',
        correct: correctStr,
        subject: q.subject || 'General'
      });
    }

    if (validQuestions.length === 0) {
      return res.status(400).json({ error: 'No valid questions found in import list' });
    }

    if (db.isPostgres()) {
      const inserted = [];
      const CHUNK_SIZE = 50;
      for (let i = 0; i < validQuestions.length; i += CHUNK_SIZE) {
        const chunk = validQuestions.slice(i, i + CHUNK_SIZE);
        const valueClauses = [];
        const params = [];
        let pIdx = 1;

        for (const item of chunk) {
          valueClauses.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8})`);
          params.push(
            item.exam_id,
            item.text,
            JSON.stringify(item.options),
            item.opt_a,
            item.opt_b,
            item.opt_c,
            item.opt_d,
            item.correct,
            item.subject
          );
          pIdx += 9;
        }

        const query = `
          INSERT INTO questions (exam_id, text, options, opt_a, opt_b, opt_c, opt_d, correct, subject)
          VALUES ${valueClauses.join(', ')}
          RETURNING *
        `;
        const { rows } = await db.query(query, params);
        inserted.push(...rows.map(formatQuestion));
      }
      return res.status(201).json({ count: inserted.length, items: inserted, questions: inserted });
    }

    const now = Date.now();
    const newItems = validQuestions.map((item, idx) => ({
      id: now + idx,
      exam_id: item.exam_id,
      text: item.text,
      options: item.options,
      optA: item.opt_a,
      optB: item.opt_b,
      optC: item.opt_c,
      optD: item.opt_d,
      correct: item.correct,
      subject: item.subject,
    }));

    if (!db.store.questions) db.store.questions = [];
    db.store.questions.unshift(...newItems);
    saveLocalStore();
    res.status(201).json({ count: newItems.length, items: newItems.map(formatQuestion), questions: newItems.map(formatQuestion) });
  } catch (err) {
    console.error('Bulk questions error:', err);
    res.status(500).json({ error: 'Failed to import questions' });
  }
});

// ── DELETE /api/questions/:id ─────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    if (db.isPostgres()) {
      await db.query('DELETE FROM questions WHERE id = $1', [id]);
      return res.json({ success: true });
    }
    db.store.questions = (db.store.questions || []).filter(q => q.id !== id);
    saveLocalStore();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

export default router;
