import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db, ensureSchema } from '../db.js';
import { JWT_SECRET, authenticate } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    await ensureSchema();
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = null;

    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND role = $2', [email, 'admin']);
      user = result.rows[0];
    } else {
      user = db.store.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === 'admin');
    }

    if (!user) {
      return res.status(401).json({ error: 'Admin account not found.' });
    }

    // Verify password - check plain 'admin123' or hash
    let passwordValid = false;
    if (user.password_hash === 'admin123' || user.password_hash === password) {
      passwordValid = true;
    } else if (user.password_hash && user.password_hash.startsWith('$2')) {
      const bcrypt = await import('bcryptjs');
      passwordValid = await bcrypt.compare(password, user.password_hash);
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roll_no: user.roll_no
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roll_no: user.roll_no
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Internal server error during login' });
  }
});

// POST /api/auth/student-login (Students log in via Roll Number ONLY)
router.post('/student-login', async (req, res) => {
  try {
    await ensureSchema();
    const { roll_no } = req.body;
    if (!roll_no || !roll_no.trim()) {
      return res.status(400).json({ error: 'Roll number is required to enter the portal' });
    }

    const cleanRoll = roll_no.trim().toUpperCase();
    let candidate = null;

    if (db.isPostgres()) {
      const q = await db.query(
        'SELECT * FROM candidates WHERE UPPER(TRIM(roll_no)) = $1 LIMIT 1',
        [cleanRoll]
      );
      candidate = q.rows[0];
    } else {
      candidate = db.store.candidates.find(
        c => c.roll_no.trim().toUpperCase() === cleanRoll
      );
    }

    if (!candidate) {
      return res.status(401).json({
        error: `Roll Number "${cleanRoll}" is not registered! Only candidates who filled the examination form are allowed.`
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
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: candidate.id,
        name: candidate.name,
        roll_no: candidate.roll_no,
        role: 'student',
        exam_id: candidate.exam_id,
      }
    });
  } catch (err) {
    console.error('Student login error:', err);
    res.status(500).json({ error: err.message || 'Internal server error during student login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;

