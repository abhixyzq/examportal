import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import examRoutes from './routes/exams.js';
import submissionRoutes from './routes/submissions.js';
import monitorRoutes from './routes/monitor.js';
import candidateRoutes from './routes/candidates.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Restrict to the configured client origin; fall back to same-origin in prod.
const allowedOrigin = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : '*');
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Body Parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' })); // reduced from 10mb — questions don't need that much

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    platform: 'Vercel Serverless',
    timestamp: new Date().toISOString(),
    service: 'Exam Portal API',
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/candidates', candidateRoutes);

// ── Global Error Handler ──────────────────────────────────────────────────────
// Never leak internal error messages to clients in production.
app.use((err, _req, res, _next) => {
  console.error('API Error:', err);
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');
  res.status(err.status || 500).json({ error: message });
});

export default app;
