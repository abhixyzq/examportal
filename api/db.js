import pg from 'pg';

const { Pool } = pg;

function getConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.STORAGE_URL ||
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    null
  );
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
    {
      id: 1,
      name: 'Admin',
      email: 'admin@exam.com',
      password_hash: '$2b$10$RShDJ0.pDgOpVgH20pvBBewfqZbUfq/i.MVhql7Tyg4h4xqe8IfuC',
      role: 'admin',
    },
  ],
  questions: [],
  exams: [],
  submissions: [],
  violations: [],
  candidates: [],
  activeStudents: {},
};

// Automatic table initialization on Vercel Postgres / Supabase
export async function ensureSchema() {
  const p = getPool();
  if (!p || schemaInitialized) return;
  schemaInitialized = true;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('admin', 'student')),
        roll_no VARCHAR(50),
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
        status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
        proctored BOOLEAN DEFAULT true,
        live_result BOOLEAN DEFAULT false,
        shuffle_q BOOLEAN DEFAULT true,
        shuffle_opt BOOLEAN DEFAULT false,
        max_violations INT DEFAULT 3,
        require_code BOOLEAN DEFAULT false,
        access_code VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        exam_id INT REFERENCES exams(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        options JSONB DEFAULT '[]'::jsonb,
        opt_a TEXT,
        opt_b TEXT,
        opt_c TEXT,
        opt_d TEXT,
        correct VARCHAR(100) NOT NULL,
        subject VARCHAR(100) DEFAULT 'General',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS exam_submissions (
        id SERIAL PRIMARY KEY,
        exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        answers JSONB DEFAULT '{}'::jsonb,
        score INT DEFAULT 0,
        total_questions INT DEFAULT 0,
        percentage INT DEFAULT 0,
        passed BOOLEAN DEFAULT false,
        violations_count INT DEFAULT 0,
        auto_submitted BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT unique_user_exam UNIQUE (exam_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS violations_log (
        id SERIAL PRIMARY KEY,
        exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        violation_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        exam_id INT REFERENCES exams(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150),
        roll_no VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Schema ensured (all tables verified)');
  } catch (err) {
    console.warn('⚠️ Schema init warning:', err.message);
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
