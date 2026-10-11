import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const hasPostgresConfig = Boolean(
  connectionString ||
  (process.env.PGUSER && process.env.PGDATABASE)
);

let pool = null;
let usePostgres = false;

// 1. Try PostgreSQL connection if configured
if (hasPostgresConfig) {
  try {
    pool = new Pool({
      connectionString: connectionString || undefined,
      ssl: connectionString ? { rejectUnauthorized: false } : undefined,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    usePostgres = true;
    console.log('🐘 Configured PostgreSQL connection pool (Supabase / Postgres)');
  } catch (err) {
    console.warn('⚠️ Could not connect to PostgreSQL. Using local fallback.', err.message);
    usePostgres = false;
  }
}

// 2. High-speed local in-memory + file persistent store fallback
const DATA_FILE = path.join(__dirname, 'data.json');

const INITIAL_DATA = {
  users: [
    { id: 1, name: 'Admin', email: 'admin@exam.com', password_hash: '$2a$10$wU2nJt8pZ9mZ0WzJ0gJ8quQ4hY0z1v3wX4y5z6a7b8c9d0e1f2g3h', role: 'admin' },
  ],
  questions: [],
  exams: [],
  submissions: [],
  violations: [],
  candidates: []
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
