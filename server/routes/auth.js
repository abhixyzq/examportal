import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, saveLocalStore } from '../db.js';
import { JWT_SECRET, authenticate } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = null;

    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      user = result.rows[0];
    } else {
      user = db.store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    // Demo admin bypass if standard demo creds used
    const isAdminDemo = (email === 'admin@exam.com' && password === 'admin123');
    const isStudentDemo = (password === 'student123');

    if (!user && (isAdminDemo || isStudentDemo)) {
      // Auto-register demo account in store
      const newUser = {
        id: Date.now(),
        name: isAdminDemo ? 'Admin' : (email.split('@')[0] || 'Student'),
        email,
        role: role || (isAdminDemo ? 'admin' : 'student'),
        roll_no: `ROLL-${Math.floor(1000 + Math.random() * 9000)}`
      };
      if (db.isPostgres()) {
        const hash = await bcrypt.hash(password, 10);
        const ins = await db.query(
          'INSERT INTO users (name, email, password_hash, role, roll_no) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [newUser.name, newUser.email, hash, newUser.role, newUser.roll_no]
        );
        user = ins.rows[0];
      } else {
        db.store.users.push(newUser);
        saveLocalStore();
        user = newUser;
      }
    } else if (!user) {
      return res.status(401).json({ error: 'User not found. Check your credentials.' });
    }

    // Role check if requested
    if (role && user.role !== role && !isAdminDemo) {
      return res.status(403).json({ error: `Account does not have ${role} role` });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, roll_no: user.roll_no },
      JWT_SECRET,
      { expiresIn: '24h' }
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
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// POST /api/auth/student-login (Students log in via Roll Number ONLY)
router.post('/student-login', async (req, res) => {
  try {
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
      candidate = (db.store.candidates || []).find(
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
    res.status(500).json({ error: 'Internal server error during student login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;
