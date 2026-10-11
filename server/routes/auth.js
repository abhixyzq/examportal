import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, saveLocalStore } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const _secret = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod';

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = null;

    if (db.isPostgres()) {
      const result = await db.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND role = $2',
        [email, 'admin']
      );
      user = result.rows[0];
    } else {
      user = db.store.users.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.role === 'admin'
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Only bcrypt hashes accepted — no plaintext or demo bypasses
    const passwordValid = user.password_hash?.startsWith('$2')
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, roll_no: user.roll_no },
      _secret,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roll_no: user.roll_no,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// ── POST /api/auth/student-login ──────────────────────────────────────────────
router.post('/student-login', async (req, res) => {
  try {
    const raw = req.body?.roll_no;
    if (!raw || !String(raw).trim()) {
      return res.status(400).json({ error: 'Roll number is required' });
    }

    const cleanRoll = String(raw).trim().toUpperCase();
    let candidate = null;

    if (db.isPostgres()) {
      const { rows } = await db.query(
        'SELECT * FROM candidates WHERE UPPER(TRIM(roll_no)) = $1 LIMIT 1',
        [cleanRoll]
      );
      candidate = rows[0];
    } else {
      candidate = (db.store.candidates || []).find(
        c => String(c.roll_no).trim().toUpperCase() === cleanRoll
      );
    }

    if (!candidate) {
      return res.status(401).json({
        error: `Roll Number "${cleanRoll}" is not registered. Only pre-registered candidates are allowed.`,
      });
    }

    const token = jwt.sign(
      {
        id: candidate.id,
        name: candidate.name,
        roll_no: candidate.roll_no,
        role: 'student',
        exam_id: candidate.exam_id,
      },
      _secret,
      { expiresIn: '4h' }
    );

    res.json({
      token,
      user: {
        id: candidate.id,
        name: candidate.name,
        roll_no: candidate.roll_no,
        role: 'student',
        exam_id: candidate.exam_id,
      },
    });
  } catch (err) {
    console.error('Student login error:', err);
    res.status(500).json({ error: 'Internal server error during student login' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/seed-admin ─────────────────────────────────────────────────
// One-time helper to create / update the admin password hash.
// Protected: only works when SEED_SECRET env matches the request header.
router.post('/seed-admin', async (req, res) => {
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret || req.headers['x-seed-secret'] !== seedSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { email, password, name = 'Admin' } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Valid email and password (min 8 chars) required' });
  }

  const hash = await bcrypt.hash(password, 12);

  if (db.isPostgres()) {
    const { rows } = await db.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
      RETURNING id, name, email, role
    `, [name, email, hash]);
    return res.json({ success: true, user: rows[0] });
  }

  const existing = db.store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.password_hash = hash;
    existing.name = name;
  } else {
    db.store.users.push({ id: Date.now(), name, email, password_hash: hash, role: 'admin' });
  }
  saveLocalStore();
  res.json({ success: true });
});

export default router;
