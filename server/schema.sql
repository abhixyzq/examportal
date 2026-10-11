-- Schema for Exam Portal (PostgreSQL)
-- Optimized for high concurrent read/writes during exams

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  roll_no VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  opt_a TEXT NOT NULL,
  opt_b TEXT NOT NULL,
  opt_c TEXT NOT NULL,
  opt_d TEXT NOT NULL,
  correct VARCHAR(5) NOT NULL CHECK (correct IN ('A', 'B', 'C', 'D')),
  subject VARCHAR(100) DEFAULT 'General',
  difficulty VARCHAR(20) DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);

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

CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);

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

CREATE INDEX IF NOT EXISTS idx_submissions_exam_user ON exam_submissions(exam_id, user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON exam_submissions(exam_id, score DESC);

CREATE TABLE IF NOT EXISTS violations_log (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  violation_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_violations_exam_user ON violations_log(exam_id, user_id);
