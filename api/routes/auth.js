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
      const result = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      user = result.rows[0];
    } else {
      user = db.store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    // Default demo account auto-resolution
    const isAdminDemo = (email === 'admin@exam.com' && password === 'admin123');
    const isStudentDemo = (password === 'student123');

    if (!user && (isAdminDemo || isStudentDemo)) {
      const newUser = {
        id: Date.now(),
        name: isAdminDemo ? 'Admin' : (email.split('@')[0] || 'Student'),
        email,
        role: role || (isAdminDemo ? 'admin' : 'student'),
        roll_no: `ROLL-${Math.floor(1000 + Math.random() * 9000)}`
      };

      if (db.isPostgres()) {
        try {
          const ins = await db.query(
            'INSERT INTO users (name, email, password_hash, role, roll_no) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [newUser.name, newUser.email, 'demo_hash', newUser.role, newUser.roll_no]
          );
          user = ins.rows[0];
        } catch {
          user = newUser;
        }
      } else {
        db.store.users.push(newUser);
        user = newUser;
      }
    } else if (!user) {
      return res.status(401).json({ error: 'User not found. Use admin123 or student123 for demo.' });
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

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;
