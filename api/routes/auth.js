import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db, ensureSchema } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const _secret = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod';

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    await ensureSchema();
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
      // Uniform error — don't reveal whether the account exists
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Password verification — bcrypt only, no plaintext fallback
    let passwordValid = false;
    if (user.password_hash?.startsWith('$2')) {
      const { default: bcrypt } = await import('bcryptjs');
      passwordValid = await bcrypt.compare(password, user.password_hash);
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roll_no: user.roll_no,
      },
      _secret,
      { expiresIn: '8h' } // reduced from 7d — admins should re-auth daily
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
// Students authenticate via Roll Number only (no password).
router.post('/student-login', async (req, res) => {
  try {
    await ensureSchema();
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
      candidate = db.store.candidates.find(
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
      { expiresIn: '4h' } // exam sessions don't need 7 days
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

export default router;
