import { Router } from 'express';
import { db, saveLocalStore } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── Shared Answer Matching Helper ─────────────────────────────────────────────
function normalizeAnswer(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(s => String(s).trim().toUpperCase()).filter(Boolean).sort();
  }
  return String(val).split(',').map(s => s.trim().toUpperCase()).filter(Boolean).sort();
}

function isMatch(studentAns, correctVal) {
  if (!studentAns || !correctVal) return false;
  const s = normalizeAnswer(studentAns);
  const c = normalizeAnswer(correctVal);
  if (s.length === 0 || c.length === 0 || s.length !== c.length) return false;
  return s.every((v, i) => v === c[i]);
}

// ── POST /api/submissions (Submit exam answers) ───────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { examId, answers = {}, autoSubmitted = false, violationsCount = 0 } = req.body;
    const userId = req.user.id;
    const numExamId = Number(examId);

    if (!numExamId) {
      return res.status(400).json({ error: 'Valid exam ID is required' });
    }

    // Reject if candidate has already submitted this exam
    if (db.isPostgres()) {
      const existing = await db.query(
        'SELECT id FROM exam_submissions WHERE exam_id = $1 AND user_id = $2',
        [numExamId, Number(userId)]
      );
      if (existing.rows.length > 0) {
        return res.status(403).json({
          error: 'You have already submitted this exam. Contact the administrator to reset your exam.'
        });
      }
    } else {
      const existing = (db.store.submissions || []).find(
        s => Number(s.exam_id) === numExamId && Number(s.user_id) === Number(userId)
      );
      if (existing) {
        return res.status(403).json({
          error: 'You have already submitted this exam. Contact the administrator to reset your exam.'
        });
      }
    }

    // Fetch questions specifically for this exam to calculate score
    let questions = [];
    if (db.isPostgres()) {
      const qRes = await db.query(
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY id ASC',
        [numExamId]
      );
      questions = qRes.rows;
      if (questions.length === 0) {
        const allRes = await db.query('SELECT * FROM questions ORDER BY id ASC');
        questions = allRes.rows;
      }
    } else {
      questions = (db.store.questions || []).filter(q => Number(q.exam_id) === numExamId);
      if (questions.length === 0) questions = db.store.questions || [];
    }

    let correctCount = 0;
    const totalQuestions = questions.length;

    questions.forEach(q => {
      const studentAns = answers[q.id];
      if (isMatch(studentAns, q.correct)) {
        correctCount += 1;
      }
    });

    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = percentage >= 60;

    const submissionData = {
      id: Date.now(),
      exam_id: numExamId,
      user_id: Number(userId),
      user_name: req.user.name,
      user_email: req.user.email,
      answers,
      score: correctCount,
      total_questions: totalQuestions,
      percentage,
      passed,
      violations_count: Number(violationsCount) || 0,
      auto_submitted: Boolean(autoSubmitted),
      status: 'submitted',
      submitted_at: new Date().toISOString()
    };

    let liveResult = false;
    let examTitle = '';
    if (db.isPostgres()) {
      const eRes = await db.query('SELECT title, live_result FROM exams WHERE id = $1', [numExamId]);
      if (eRes.rows.length > 0) {
        liveResult = Boolean(eRes.rows[0].live_result);
        examTitle = eRes.rows[0].title;
      }

      const q = `
        INSERT INTO exam_submissions (exam_id, user_id, answers, score, total_questions, percentage, passed, violations_count, auto_submitted, status, submitted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', NOW())
        ON CONFLICT (exam_id, user_id) DO UPDATE SET
          answers = EXCLUDED.answers,
          score = EXCLUDED.score,
          total_questions = EXCLUDED.total_questions,
          percentage = EXCLUDED.percentage,
          passed = EXCLUDED.passed,
          violations_count = EXCLUDED.violations_count,
          auto_submitted = EXCLUDED.auto_submitted,
          status = 'submitted',
          submitted_at = NOW()
        RETURNING *
      `;
      const { rows } = await db.query(q, [
        numExamId, Number(userId), JSON.stringify(answers), correctCount, totalQuestions,
        percentage, passed, Number(violationsCount) || 0, Boolean(autoSubmitted)
      ]);
      return res.status(201).json({
        ...rows[0],
        live_result: liveResult,
        liveResult,
        exam_title: examTitle
      });
    }

    const ex = (db.store.exams || []).find(e => e.id === numExamId);
    if (ex) {
      liveResult = Boolean(ex.live_result || ex.liveResult);
      examTitle = ex.title;
    }

    if (!db.store.submissions) db.store.submissions = [];
    const existingIdx = db.store.submissions.findIndex(
      s => Number(s.exam_id) === numExamId && Number(s.user_id) === Number(userId)
    );
    const fullSubmissionData = {
      ...submissionData,
      live_result: liveResult,
      liveResult,
      exam_title: examTitle
    };

    if (existingIdx >= 0) {
      db.store.submissions[existingIdx] = fullSubmissionData;
    } else {
      db.store.submissions.unshift(fullSubmissionData);
    }
    saveLocalStore();

    res.status(201).json(fullSubmissionData);
  } catch (err) {
    console.error('Submit exam error:', err);
    res.status(500).json({ error: 'Failed to record exam submission' });
  }
});

// ── GET /api/submissions/results/:examId (Admin view results only) ────────────
router.get('/results/:examId', authenticate, requireAdmin, async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    if (db.isPostgres()) {
      const q = `
        SELECT s.*,
               COALESCE(c.name, u.name, 'Candidate') as user_name,
               COALESCE(c.roll_no, u.roll_no, '') as roll_no,
               COALESCE(u.email, '') as user_email
        FROM exam_submissions s
        LEFT JOIN candidates c ON s.user_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.exam_id = $1
        ORDER BY s.score DESC, s.submitted_at ASC
      `;
      const { rows } = await db.query(q, [examId]);
      return res.json(rows);
    }
    const results = (db.store.submissions || []).filter(s => Number(s.exam_id) === examId);
    res.json(results);
  } catch (err) {
    console.error('Fetch results error:', err);
    res.status(500).json({ error: 'Failed to retrieve exam results' });
  }
});

// ── GET /api/submissions/my-results (Student view own result) ─────────────────
router.get('/my-results', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    if (db.isPostgres()) {
      const q = `
        SELECT s.*, e.title as exam_title, e.subject, e.live_result
        FROM exam_submissions s
        JOIN exams e ON s.exam_id = e.id
        WHERE s.user_id = $1
        ORDER BY s.submitted_at DESC
      `;
      const { rows } = await db.query(q, [userId]);
      return res.json(rows);
    }
    const mySubmissions = (db.store.submissions || []).filter(s => s.user_id === userId);
    res.json(mySubmissions);
  } catch (err) {
    console.error('Fetch my-results error:', err);
    res.status(500).json({ error: 'Failed to retrieve your results' });
  }
});

// ── POST /api/submissions/reset (Admin resets a candidate's exam submission) ──
router.post('/reset', authenticate, requireAdmin, async (req, res) => {
  try {
    const { submissionId, examId, userId } = req.body;
    if (db.isPostgres()) {
      if (submissionId) {
        await db.query('DELETE FROM exam_submissions WHERE id = $1', [Number(submissionId)]);
      } else if (examId && userId) {
        await db.query(
          'DELETE FROM exam_submissions WHERE exam_id = $1 AND user_id = $2',
          [Number(examId), Number(userId)]
        );
      }
      return res.json({ success: true, message: 'Candidate exam successfully reset.' });
    }

    if (!db.store.submissions) db.store.submissions = [];
    if (submissionId) {
      db.store.submissions = db.store.submissions.filter(s => s.id !== Number(submissionId));
    } else if (examId && userId) {
      db.store.submissions = db.store.submissions.filter(
        s => !(Number(s.exam_id) === Number(examId) && Number(s.user_id) === Number(userId))
      );
    }
    saveLocalStore();
    res.json({ success: true, message: 'Candidate exam successfully reset.' });
  } catch (err) {
    console.error('Reset submission error:', err);
    res.status(500).json({ error: 'Failed to reset exam submission' });
  }
});

export default router;
