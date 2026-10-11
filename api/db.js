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
  // Tables are verified and created on Supabase
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
