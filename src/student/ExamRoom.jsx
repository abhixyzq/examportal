import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProctoring } from '../hooks/useProctoring';
import { ViolationWarning } from '../pages/Login';
import { DEMO_QUESTIONS, getStoredExams } from '../data/demo';
import ThemeToggle from '../components/ThemeToggle';
import { ClockIcon, ShieldIcon, LockIcon, KeyIcon } from '../components/Icons';

function Timer({ secondsLeft }) {
  const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const s = (secondsLeft % 60).toString().padStart(2, '0');
  const cls = secondsLeft < 300 ? 'danger' : secondsLeft < 600 ? 'warning' : '';
  return (
    <div className={`timer ${cls}`}>
      <ClockIcon size={14} />
      <span>{m}:{s}</span>
    </div>
  );
}

export default function ExamRoom() {
  const navigate = useNavigate();
  const { id } = useParams();
  const exams = getStoredExams();
  const currentExam = exams.find(e => String(e.id) === String(id)) || exams[1] || exams[0];

  const questions = DEMO_QUESTIONS;
  const [hasStarted, setHasStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState((currentExam?.duration || 60) * 60);
  const [submitted, setSubmitted] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Access Code check
  const requiresCode = Boolean(currentExam?.requireCode);
  const [codeVerified, setCodeVerified] = useState(() => {
    if (!requiresCode) return true;
    return sessionStorage.getItem(`ep_exam_auth_${currentExam?.id}`) === 'true';
  });
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleAutoSubmit = useCallback(() => {
    setSubmitted(true);
    navigate('/student/result', { state: { answers, autoSubmit: true } });
  }, [answers, navigate]);

  const handleViolation = useCallback((v) => {
    console.log('Proctoring Violation Logged:', v);
  }, []);

  const {
    showWarning, warningType, dismissWarning, enterFullscreen,
    showReloadWarning, dismissReloadWarning,
    violationCount, remaining, maxViolations,
  } = useProctoring({
    enabled: hasStarted,
    maxViolations: currentExam?.maxViolations || 3,
    onAutoSubmit: handleAutoSubmit,
    onViolation: handleViolation,
  });

  // Timer only runs once exam has started
  useEffect(() => {
    if (!hasStarted || submitted) return;
    const t = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearInterval(t); handleAutoSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [hasStarted, submitted, handleAutoSubmit]);

  const selectAnswer = (qId, opt) => {
    setAnswers(prev => ({ ...prev, [qId]: opt }));
  };

  const handleSubmit = () => {
    navigate('/student/result', { state: { answers } });
  };

  const handleStartWithCodeCheck = async (e) => {
    if (e) e.preventDefault();
    if (requiresCode && !codeVerified) {
      const entered = inputCode.trim().toUpperCase();
      const target = (currentExam?.accessCode || '').trim().toUpperCase();
      if (entered === target) {
        sessionStorage.setItem(`ep_exam_auth_${currentExam?.id}`, 'true');
        setCodeVerified(true);
        setCodeError('');
        await enterFullscreen();
        setHasStarted(true);
      } else {
        setCodeError('Invalid Hall Access Code! Please ask your exam invigilator.');
      }
    } else {
      await enterFullscreen();
      setHasStarted(true);
    }
  };

  const q = questions[current] || questions[0];
  const opts = ['A', 'B', 'C', 'D'];
  const optTexts = { A: q?.optA, B: q?.optB, C: q?.optC, D: q?.optD };

  return (
    <>
      {/* 1. Mandatory Proctored Exam Instructions Gate */}
      {!hasStarted && (
        <div className="violation-overlay">
          <div className="violation-box" style={{ maxWidth: 440, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ color: 'var(--primary)', display: 'flex' }}>
                <ShieldIcon size={24} />
              </div>
              <div className="violation-title" style={{ color: 'var(--text)', margin: 0, fontSize: 17 }}>
                {currentExam?.title || 'Exam'} Instructions
              </div>
            </div>

            <div className="violation-text" style={{ textAlign: 'left', fontSize: 13, color: 'var(--text-sub)', marginBottom: 18 }}>
              <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                <li><strong>Fullscreen:</strong> Mandatory full screen lock. Exiting triggers a warning.</li>
                <li><strong>Tab Switching:</strong> Strictly prohibited. Leaving the exam tab is recorded.</li>
                <li><strong>Shortcuts & Mouse:</strong> Right-click, Copy/Paste, DevTools, and Screenshots are blocked.</li>
                <li><strong>Max Warnings:</strong> {currentExam?.maxViolations || 3} allowed before auto-submit.</li>
              </ul>
            </div>

            {requiresCode && !codeVerified ? (
              <form onSubmit={handleStartWithCodeCheck}>
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: 14, border: '1px solid var(--border)' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <LockIcon size={12} /> Enter Exam Hall Access Code
                  </label>
                  <input
                    className="form-control"
                    placeholder="e.g. PHYS90"
                    value={inputCode}
                    onChange={e => {
                      setInputCode(e.target.value.toUpperCase());
                      setCodeError('');
                    }}
                    required
                    autoFocus
                    style={{
                      letterSpacing: '3px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: 16,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                    Available only to candidates inside the exam hall from the invigilator.
                  </div>
                </div>

                {codeError && (
                  <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>
                    {codeError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  style={{ padding: '10px 16px', fontSize: 14, justifyContent: 'center' }}
                >
                  Verify Code & Start Exam
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-primary w-full"
                style={{ padding: '10px 16px', fontSize: 14, justifyContent: 'center' }}
                onClick={handleStartWithCodeCheck}
              >
                Start Exam in Fullscreen
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Violation Alert Modal */}
      {showWarning && (
        <ViolationWarning
          type={warningType}
          remaining={remaining}
          onDismiss={dismissWarning}
          onReenter={enterFullscreen}
        />
      )}

      {/* 3. Confirm Submit Modal */}
      {confirmSubmit && (
        <div className="violation-overlay">
          <div className="violation-box">
            <div className="violation-title" style={{ color: 'var(--text)' }}>Submit Exam?</div>
            <div className="violation-text">
              You have answered {Object.keys(answers).length} of {questions.length} questions.
              This action cannot be undone.
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary w-full" onClick={handleSubmit}>Submit</button>
              <button className="btn btn-ghost w-full" onClick={() => setConfirmSubmit(false)}>Go Back</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Page Reload Warning Modal */}
      {showReloadWarning && (
        <div className="violation-overlay">
          <div className="violation-box" style={{ maxWidth: 390 }}>
            <div style={{ color: 'var(--warning)', display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <ShieldIcon size={32} />
            </div>
            <div className="violation-title" style={{ color: 'var(--warning)' }}>
              Page Reload Warning
            </div>
            <div className="violation-text">
              Refreshing or reloading the page during an active exam is not allowed. Your answers or exam timer may be lost.
            </div>
            <button className="btn btn-primary w-full" onClick={dismissReloadWarning}>
              Continue Exam
            </button>
          </div>
        </div>
      )}

      <div className="exam-layout">
        {/* Main exam area */}
        <div className="exam-main">
          <div className="exam-topbar">
            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              <div className="exam-title">{currentExam?.title || 'Exam'}</div>
              {requiresCode && (
                <span className="badge badge-yellow" style={{ fontSize: 11, gap: 4 }}>
                  <LockIcon size={11} /> Hall Verified
                </span>
              )}
              <span className="badge badge-blue" style={{ fontSize: 11.5, gap: 5 }}>
                <ShieldIcon size={12} /> Proctored
              </span>
            </div>
            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              {violationCount > 0 ? (
                <span className="badge badge-red" style={{ fontSize: 12 }}>
                  {violationCount} / {maxViolations} Violation{violationCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="badge badge-green" style={{ fontSize: 12 }}>
                  0 Warnings
                </span>
              )}
              <Timer secondsLeft={secondsLeft} />
              <ThemeToggle showLabel={false} />
              <button className="btn btn-primary btn-sm" onClick={() => setConfirmSubmit(true)}>
                Submit
              </button>
            </div>
          </div>

          <div className="exam-body">
            <div className="question-count">Question {current + 1} of {questions.length}</div>
            <div className="question-text">{q?.text}</div>
            <div className="options-list">
              {opts.map(opt => (
                <div
                  key={opt}
                  className={`option-item ${answers[q?.id] === opt ? 'selected' : ''}`}
                  onClick={() => selectAnswer(q?.id, opt)}
                >
                  <div className="option-letter">{opt}</div>
                  <div className="option-text">{optTexts[opt]}</div>
                </div>
              ))}
            </div>

            <div className="flex-between mt-3">
              <button
                className="btn btn-ghost"
                disabled={current === 0}
                onClick={() => setCurrent(c => c - 1)}
              >
                ← Previous
              </button>
              <button
                className="btn btn-ghost"
                disabled={current === questions.length - 1}
                onClick={() => setCurrent(c => c + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Question nav sidebar */}
        <div className="question-nav">
          <div className="nav-title">Questions</div>
          <div className="q-grid">
            {questions.map((question, i) => {
              const ans = answers[question.id];
              const isCurrent = i === current;
              const cls = isCurrent ? 'current' : ans ? 'answered' : '';
              return (
                <div
                  key={question.id}
                  className={`q-dot ${cls}`}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>

          <div className="nav-legend">
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--primary)' }} />
              <span>Current</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--success)' }} />
              <span>Answered</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--border)' }} />
              <span>Not Answered</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className="meta-row mb-1">
              <span>Answered</span>
              <span className="meta-val">{Object.keys(answers).length} / {questions.length}</span>
            </div>
            <div className="meta-row">
              <span>Remaining</span>
              <span className="meta-val">{questions.length - Object.keys(answers).length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
