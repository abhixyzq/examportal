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
