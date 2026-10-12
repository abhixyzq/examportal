import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import examRoutes from './routes/exams.js';
import submissionRoutes from './routes/submissions.js';
import candidateRoutes from './routes/candidates.js';
import { setupMonitorSockets } from './sockets/monitor.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production';

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: isProduction ? CLIENT_URL : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: isProduction ? CLIENT_URL : '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ── Body Parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'NCE Club Pass Backend',
    version: '1.0.0',
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/candidates', candidateRoutes);

// ── Socket Monitoring Engine ──────────────────────────────────────────────────
setupMonitorSockets(io);

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('API Error:', err);
  const message = isProduction ? 'Internal Server Error' : (err.message || 'Internal Server Error');
  res.status(err.status || 500).json({ error: message });
});

server.listen(PORT, () => {
  console.log(`🚀 NCE Club Pass Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io Real-Time Proctoring ready`);
});
