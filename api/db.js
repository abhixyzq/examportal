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

// Clean production in-memory store
const store = {
  users: [
    { id: 1, name: 'Admin', email: 'admin@exam.com', role: 'admin' },
  ],
  questions: [],
  exams: [],
  submissions: [],
  violations: [],
  candidates: [],
  activeStudents: {},
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

      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        roll_no VARCHAR(100) NOT NULL,
        name VARCHAR(150) NOT NULL,
        exam_id INT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_candidates_roll ON candidates(LOWER(roll_no));
    `);

    // Clean out any previously seeded dummy test records
    await p.query(`
      DELETE FROM exams WHERE access_code IN ('MATH26', 'PHYS90') OR title IN ('Mathematics Test', 'Physics Mid-Term', 'Chemistry Quiz');
      DELETE FROM questions WHERE text LIKE 'What is the value of π%' OR text LIKE 'Which of the following is Newton%' OR text LIKE 'What is the atomic number of Carbon%';
      DELETE FROM candidates WHERE roll_no IN ('2026-CS-101', '2026-CS-102', '2026-CS-103', '2026-CS-104', '2026-CS-105');
    `).catch(() => {});

    schemaInitialized = true;
    console.log('✅ PostgreSQL Schema verified (zero dummy data)');
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
