import pg from 'pg';

const { Pool } = pg;

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.STORAGE_URL) return process.env.STORAGE_URL;
  if (process.env.STORAGE_DATABASE_URL) return process.env.STORAGE_DATABASE_URL;
  if (process.env.STORAGE_POSTGRES_URL) return process.env.STORAGE_POSTGRES_URL;
  for (const [key, val] of Object.entries(process.env)) {
    if (typeof val === 'string' && val.startsWith('postgres')) {
      return val;
    }
  }
  return null;
}

let pool = null;
let usePostgres = false;
let schemaInitialized = false;

function getPool() {
  if (pool) return pool;
  const conn = getConnectionString();
  if (conn) {
    try {
      pool = new Pool({
        connectionString: conn,
        ssl: {
          rejectUnauthorized: false
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      usePostgres = true;
      console.log('🐘 PostgreSQL Pool configured');
      return pool;
    } catch (err) {
      console.warn('⚠️ Postgres initialization warning:', err.message);
      usePostgres = false;
    }
  }
  return null;
}

// In-memory fallback dataset for zero-friction run if DB not yet connected
const store = {
  users: [
    { id: 1, name: 'Admin', email: 'admin@exam.com', role: 'admin' },
    { id: 2, name: 'Rahul Sharma', email: 'student@exam.com', role: 'student', roll_no: '2026-CS-101' },
    { id: 3, name: 'Priya Patel', email: 'priya@exam.com', role: 'student', roll_no: '2026-CS-102' },
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
  activeStudents: {}, // In-memory telemetry cache for live monitor
};

// Automatic table initialization on Vercel Postgres
export async function ensureSchema() {
  const p = getPool();
  if (!p || schemaInitialized) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'student',
        roll_no VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        opt_a TEXT NOT NULL,
        opt_b TEXT NOT NULL,
        opt_c TEXT NOT NULL,
        opt_d TEXT NOT NULL,
        correct VARCHAR(5) NOT NULL,
        subject VARCHAR(100) DEFAULT 'General',
        difficulty VARCHAR(20) DEFAULT 'easy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        subject VARCHAR(100) NOT NULL,
        duration_mins INT NOT NULL DEFAULT 60,
        total_questions INT NOT NULL DEFAULT 20,
        date VARCHAR(20) NOT NULL,
        time VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'upcoming',
        proctored BOOLEAN DEFAULT true,
        live_result BOOLEAN DEFAULT false,
        shuffle_q BOOLEAN DEFAULT true,
        shuffle_opt BOOLEAN DEFAULT false,
        max_violations INT DEFAULT 3,
        require_code BOOLEAN DEFAULT false,
        access_code VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS exam_submissions (
        id SERIAL PRIMARY KEY,
        exam_id INT NOT NULL,
        user_id INT NOT NULL,
        answers JSONB DEFAULT '{}'::jsonb,
        score INT DEFAULT 0,
        total_questions INT DEFAULT 0,
        percentage INT DEFAULT 0,
        passed BOOLEAN DEFAULT false,
        violations_count INT DEFAULT 0,
        auto_submitted BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'submitted',
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_exam UNIQUE (exam_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS violations_log (
        id SERIAL PRIMARY KEY,
        exam_id INT NOT NULL,
        user_id INT NOT NULL,
        violation_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default exams if empty
    const checkExams = await p.query('SELECT COUNT(*) FROM exams');
    if (parseInt(checkExams.rows[0].count) === 0) {
      for (const ex of store.exams) {
        await p.query(
          `INSERT INTO exams (title, subject, duration_mins, total_questions, date, time, status, proctored, live_result, shuffle_q, shuffle_opt, max_violations, require_code, access_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [ex.title, ex.subject, ex.duration_mins, ex.total_questions, ex.date, ex.time, ex.status, ex.proctored, ex.live_result, ex.shuffle_q, ex.shuffle_opt, ex.max_violations, ex.require_code, ex.access_code]
        );
      }
    }

    // Seed default questions if empty
    const checkQ = await p.query('SELECT COUNT(*) FROM questions');
    if (parseInt(checkQ.rows[0].count) === 0) {
      for (const q of store.questions) {
        await p.query(
          `INSERT INTO questions (text, opt_a, opt_b, opt_c, opt_d, correct, subject, difficulty)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [q.text, q.optA, q.optB, q.optC, q.optD, q.correct, q.subject, q.difficulty]
        );
      }
    }

    schemaInitialized = true;
    console.log('✅ PostgreSQL Schema and initial seeds verified');
  } catch (err) {
    console.warn('Postgres schema ensure warning:', err.message);
  }
}

export const db = {
  isPostgres: () => Boolean(getPool()),
  query: async (text, params) => {
    const p = getPool();
    if (p) {
      return p.query(text, params);
    }
    throw new Error('Postgres not connected');
  },
  store,
};
