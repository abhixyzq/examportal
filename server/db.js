import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const hasPostgresConfig = Boolean(
  process.env.DATABASE_URL ||
  (process.env.PGUSER && process.env.PGDATABASE)
);

let pool = null;
let usePostgres = false;

// 1. Try PostgreSQL connection if configured
if (hasPostgresConfig) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE || 'examportal',
      max: 50, // Connection pool tuned for concurrent queries
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    usePostgres = true;
    console.log('🐘 Configured PostgreSQL connection pool');
  } catch (err) {
    console.warn('⚠️ Could not connect to PostgreSQL. Using local high-speed persistent store.', err.message);
    usePostgres = false;
  }
}

// 2. High-speed local in-memory + file persistent store fallback
const DATA_FILE = path.join(__dirname, 'data.json');

const INITIAL_DATA = {
  users: [
    { id: 1, name: 'Admin', email: 'admin@exam.com', password_hash: '$2a$10$wU2nJt8pZ9mZ0WzJ0gJ8quQ4hY0z1v3wX4y5z6a7b8c9d0e1f2g3h', role: 'admin' },
    { id: 2, name: 'Rahul Sharma', email: 'student@exam.com', password_hash: '$2a$10$wU2nJt8pZ9mZ0WzJ0gJ8quQ4hY0z1v3wX4y5z6a7b8c9d0e1f2g3h', role: 'student', roll_no: '2026-CS-101' },
  ],
  questions: [
    { id: 1, text: 'What is the value of π (pi) to 2 decimal places?', optA: '3.14', optB: '3.41', optC: '3.12', optD: '3.16', correct: 'A', subject: 'Math', difficulty: 'easy' },
    { id: 2, text: 'Which of the following is Newton\'s Second Law of Motion?', optA: 'F = ma', optB: 'E = mc²', optC: 'v = u + at', optD: 'P = mv', correct: 'A', subject: 'Physics', difficulty: 'easy' },
    { id: 3, text: 'What is the atomic number of Carbon?', optA: '6', optB: '12', optC: '8', optD: '4', correct: 'A', subject: 'Chemistry', difficulty: 'easy' },
    { id: 4, text: 'Solve: If 2x + 5 = 17, what is x?', optA: '5', optB: '6', optC: '4', optD: '7', correct: 'B', subject: 'Math', difficulty: 'medium' },
    { id: 5, text: 'What is the SI unit of Electric Current?', optA: 'Volt', optB: 'Watt', optC: 'Ampere', optD: 'Ohm', correct: 'C', subject: 'Physics', difficulty: 'easy' },
  ],
  exams: [
    { id: 1, title: 'Mathematics Test', subject: 'Math', duration_mins: 60, total_questions: 30, date: '2026-10-15', time: '10:00', status: 'upcoming', proctored: true, live_result: false, shuffle_q: true, shuffle_opt: true, require_code: true, access_code: 'MATH26', max_violations: 3 },
    { id: 2, title: 'Physics Mid-Term', subject: 'Physics', duration_mins: 90, total_questions: 50, date: '2026-10-11', time: '11:00', status: 'active', proctored: true, live_result: true, shuffle_q: true, shuffle_opt: false, require_code: true, access_code: 'PHYS90', max_violations: 3 },
    { id: 3, title: 'Chemistry Quiz', subject: 'Chemistry', duration_mins: 30, total_questions: 20, date: '2026-10-05', time: '09:00', status: 'completed', proctored: false, live_result: true, shuffle_q: false, shuffle_opt: false, require_code: false, access_code: '', max_violations: 3 },
  ],
  submissions: [],
  violations: [],
  candidates: [
    { id: 1, roll_no: '2026-CS-101', name: 'Rahul Sharma', exam_id: null },
    { id: 2, roll_no: '2026-CS-102', name: 'Priya Patel', exam_id: null },
    { id: 3, roll_no: '2026-CS-103', name: 'Amit Kumar', exam_id: null },
    { id: 4, roll_no: '2026-CS-104', name: 'Sneha Singh', exam_id: null },
    { id: 5, roll_no: '2026-CS-105', name: 'Vikas Verma', exam_id: null },
  ]
};

function loadLocalStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed reading data.json:', err.message);
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
  return INITIAL_DATA;
}

let memoryStore = loadLocalStore();

export function saveLocalStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2));
  } catch (err) {
    console.error('Failed saving data.json:', err.message);
  }
}

// Database query abstraction
export const db = {
  isPostgres: () => usePostgres,
  
  query: async (text, params) => {
    if (usePostgres && pool) {
      return pool.query(text, params);
    }
    throw new Error('Postgres not connected');
  },
  
  // In-memory accessors for zero-friction local run
  store: memoryStore,
};
