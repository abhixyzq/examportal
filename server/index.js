import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import examRoutes from './routes/exams.js';
import submissionRoutes from './routes/submissions.js';
import { setupMonitorSockets } from './sockets/monitor.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Setup Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
  // Tuned for high concurrent persistent connections
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Exam Portal Backend API',
    version: '1.0.0'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/submissions', submissionRoutes);

// Setup Socket Monitoring Engine
setupMonitorSockets(io);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

server.listen(PORT, () => {
  console.log(`🚀 Exam Portal Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io Real-Time Proctoring ready for concurrent students`);
});
