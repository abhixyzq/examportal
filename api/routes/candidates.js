import { Router } from 'express';
import { db, ensureSchema } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── GET /api/candidates (List candidates) ─────────────────────────────────────
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
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
    console.error('Fetch candidates error:', err);
    res.status(500).json({ error: 'Failed to retrieve candidates' });
  }
});

// ── POST /api/candidates (Add single candidate) ───────────────────────────────
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const { roll_no, name, exam_id } = req.body;
    if (!roll_no || !String(roll_no).trim() || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'Roll number and candidate name are required' });
    }

    const cleanRoll = String(roll_no).trim().toUpperCase();
    const cleanName = String(name).trim();
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
    res.status(201).json(newCandidate);
  } catch (err) {
    console.error('Create candidate error:', err);
    res.status(500).json({ error: 'Failed to add candidate' });
  }
});

// ── POST /api/candidates/bulk (Bulk import candidates) ────────────────────────
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const { candidates, exam_id } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'Array of candidates is required' });
    }

    const examIdVal = exam_id ? Number(exam_id) : null;
    const validList = [];

    for (const c of candidates) {
      if (!c.roll_no || !c.name) continue;
      const cleanRoll = String(c.roll_no).trim().toUpperCase();
      const cleanName = String(c.name).trim();
      if (!cleanRoll || !cleanName) continue;
      validList.push({ roll_no: cleanRoll, name: cleanName, exam_id: examIdVal });
    }

    if (validList.length === 0) {
      return res.status(400).json({ error: 'No valid candidate entries provided' });
    }

    if (db.isPostgres()) {
      const inserted = [];
      const CHUNK_SIZE = 100;
      for (let i = 0; i < validList.length; i += CHUNK_SIZE) {
        const chunk = validList.slice(i, i + CHUNK_SIZE);
        const valueClauses = [];
        const params = [];
        let pIdx = 1;

        for (const item of chunk) {
          valueClauses.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2})`);
          params.push(item.roll_no, item.name, item.exam_id);
          pIdx += 3;
        }

        const query = `
          INSERT INTO candidates (roll_no, name, exam_id)
          VALUES ${valueClauses.join(', ')}
          RETURNING *
        `;
        const { rows } = await db.query(query, params);
        inserted.push(...rows);
      }
      return res.status(201).json({ count: inserted.length, candidates: inserted });
    }

    const now = Date.now();
    const added = validList.map((item, idx) => ({
      id: now + idx,
      roll_no: item.roll_no,
      name: item.name,
      exam_id: item.exam_id,
      created_at: new Date().toISOString()
    }));

    if (!db.store.candidates) db.store.candidates = [];
    db.store.candidates.unshift(...added);
    res.status(201).json({ count: added.length, candidates: added });
  } catch (err) {
    console.error('Bulk candidates import error:', err);
    res.status(500).json({ error: 'Failed to import candidates roster' });
  }
});

// ── DELETE /api/candidates/:id ────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid candidate ID' });
    }

    if (db.isPostgres()) {
      await db.query('DELETE FROM candidates WHERE id = $1', [id]);
      return res.json({ success: true });
    }

    if (db.store.candidates) {
      db.store.candidates = db.store.candidates.filter(c => c.id !== id);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete candidate error:', err);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

export default router;
