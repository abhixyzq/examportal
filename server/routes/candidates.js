import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/candidates (List candidates)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { examId } = req.query;

    if (db.isPostgres()) {
      let query = `
        SELECT c.*, e.title as exam_title
        FROM candidates c
        LEFT JOIN exams e ON c.exam_id = e.id
      `;
      const params = [];
      if (examId && examId !== 'all') {
        query += ' WHERE c.exam_id = $1 OR c.exam_id IS NULL';
        params.push(Number(examId));
      }
      query += ' ORDER BY c.id DESC';
      const { rows } = await db.query(query, params);
      return res.json(rows);
    }

    let list = db.store.candidates || [];
    if (examId && examId !== 'all') {
      list = list.filter(c => !c.exam_id || c.exam_id === Number(examId));
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates (Add single candidate)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roll_no, name, exam_id } = req.body;
    if (!roll_no || !name) {
      return res.status(400).json({ error: 'Roll number and student name are required' });
    }

    const cleanRoll = roll_no.trim().toUpperCase();
    const cleanName = name.trim();
    const examIdVal = exam_id ? Number(exam_id) : null;

    if (db.isPostgres()) {
      const q = `
        INSERT INTO candidates (roll_no, name, exam_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const { rows } = await db.query(q, [cleanRoll, cleanName, examIdVal]);
      return res.status(201).json(rows[0]);
    }

    const newCandidate = {
      id: Date.now(),
      roll_no: cleanRoll,
      name: cleanName,
      exam_id: examIdVal,
      created_at: new Date().toISOString()
    };
    if (!db.store.candidates) db.store.candidates = [];
    db.store.candidates.unshift(newCandidate);
    saveLocalStore();
    res.status(201).json(newCandidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates/bulk (Bulk import candidates from CSV / pasted roster)
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { candidates, exam_id } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'Array of candidates is required' });
    }

    const examIdVal = exam_id ? Number(exam_id) : null;
    const inserted = [];

    if (db.isPostgres()) {
      for (const c of candidates) {
        if (!c.roll_no || !c.name) continue;
        const cleanRoll = String(c.roll_no).trim().toUpperCase();
        const cleanName = String(c.name).trim();
        const ins = await db.query(
          `INSERT INTO candidates (roll_no, name, exam_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [cleanRoll, cleanName, examIdVal]
        );
        inserted.push(ins.rows[0]);
      }
      return res.status(201).json({ count: inserted.length, candidates: inserted });
    }

    if (!db.store.candidates) db.store.candidates = [];
    candidates.forEach((c, idx) => {
      if (!c.roll_no || !c.name) return;
      const cleanRoll = String(c.roll_no).trim().toUpperCase();
      const cleanName = String(c.name).trim();
      const newC = {
        id: Date.now() + idx,
        roll_no: cleanRoll,
        name: cleanName,
        exam_id: examIdVal,
        created_at: new Date().toISOString()
      };
      db.store.candidates.unshift(newC);
      inserted.push(newC);
    });
    saveLocalStore();

    res.status(201).json({ count: inserted.length, candidates: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/candidates/:id (Remove a candidate)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (db.isPostgres()) {
      await db.query('DELETE FROM candidates WHERE id = $1', [id]);
      return res.json({ success: true });
    }

    if (db.store.candidates) {
      db.store.candidates = db.store.candidates.filter(c => c.id !== id);
      saveLocalStore();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
