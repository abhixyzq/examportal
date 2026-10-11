import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProctoring } from '../hooks/useProctoring';
import { ViolationWarning } from '../pages/Login';
import ThemeToggle from '../components/ThemeToggle';
import QuestionDisplay from '../components/QuestionDisplay';
import { ClockIcon, ShieldIcon, LockIcon, KeyIcon, CloseIcon } from '../components/Icons';
import { getSocket } from '../services/socket';
import { api } from '../services/api';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentExam, setCurrentExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMobileNav, setShowMobileNav] = useState(false);


  useEffect(() => {
    Promise.all([
      api.getExams().catch(() => []),
      api.getQuestions(id).catch(() => [])
    ]).then(([examList, qList]) => {
      const found = (examList || []).find(e => String(e.id) === String(id)) || examList?.[0] || null;
      setCurrentExam(found);
      setQuestions(qList || []);
      if (found?.duration_mins || found?.duration) {
        setSecondsLeft((found.duration_mins || found.duration) * 60);
      }
      setLoading(false);
    });
  }, [id]);

  const [hasStarted, setHasStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(3600);
  const [submitted, setSubmitted] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Access Code check
  const requiresCode = Boolean(currentExam?.requireCode || currentExam?.require_code);
  const [codeVerified, setCodeVerified] = useState(() => {
    return sessionStorage.getItem(`ep_exam_auth_${id}`) === 'true';
  });
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleAutoSubmit = useCallback(async () => {
    setSubmitted(true);
    let subRes = null;
    try {
      subRes = await api.submitExam({
        examId: currentExam?.id,
        answers,
        autoSubmitted: true,
        violationsCount: 3,
      });
    } catch {}
    const isLive = subRes?.live_result ?? (currentExam?.live_result ?? currentExam?.liveResult ?? false);
    navigate('/student/result', {
      state: {
        answers,
        autoSubmit: true,
        questions,
        exam: currentExam,
        submission: subRes,
        liveResult: Boolean(isLive)
      }
    });
  }, [answers, currentExam, navigate, questions]);

  const handleViolation = useCallback((v) => {
    try {
      const socket = getSocket();
      socket.emit('student:violation', {
        examId: currentExam?.id,
        studentId: user?.id || 2,
        violationType: v.type,
        count: v.count,
      });
    } catch {}

    // Send to serverless API
    if (currentExam?.id) {
      api.reportViolation({
        examId: currentExam.id,
        violationType: v.type,
        count: v.count,
      }).then(res => {
        if (res?.disqualified) {
          alert('You have exceeded the maximum violations and have been disqualified.');
          handleAutoSubmit();
        }
      }).catch(() => {});
    }
  }, [currentExam, user, handleAutoSubmit]);

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

  // Socket setup & Serverless Heartbeat
  useEffect(() => {
    if (!hasStarted) return;
    const socket = getSocket();

    try {
      socket.emit('student:join', {
        examId: currentExam?.id,
        studentId: user?.id || 2,
        name: user?.name || 'Student',
        email: user?.email || '',
        totalQuestions: questions.length,
      });
    } catch {}

    // Initial ping
    if (currentExam?.id) {
      api.sendHeartbeat({
        examId: currentExam.id,
        answered: Object.keys(answers).length,
        timeLeft: `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`,
        total: questions.length,
      }).catch(() => {});
    }

    const heartbeatInterval = setInterval(() => {
      const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
      const s = (secondsLeft % 60).toString().padStart(2, '0');
      try {
        socket.emit('student:heartbeat', {
          examId: currentExam?.id,
          studentId: user?.id || 2,
          answered: Object.keys(answers).length,
          timeLeft: `${m}:${s}`,
        });
      } catch {}

      if (currentExam?.id) {
        api.sendHeartbeat({
          examId: currentExam.id,
          answered: Object.keys(answers).length,
          timeLeft: `${m}:${s}`,
          total: questions.length,
        }).then(res => {
          if (res?.disqualified) {
            alert('Exam auto-submitted: Disqualified by invigilator');
            handleAutoSubmit();
          }
        }).catch(() => {});
      }
    }, 6000);

    socket.on('exam:terminated', (data) => {
      alert(`Exam auto-submitted: ${data?.reason || 'Disqualified by invigilator'}`);
      handleAutoSubmit();
    });

    return () => {
      clearInterval(heartbeatInterval);
      try { socket.off('exam:terminated'); } catch {}
    };
  }, [hasStarted, currentExam, user, questions.length, secondsLeft, answers, handleAutoSubmit]);

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

  const isOptionSelected = (qId, letter) => {
    const val = answers[qId];
    if (!val) return false;
    if (Array.isArray(val)) return val.includes(letter);
    return String(val).split(',').map(s => s.trim().toUpperCase()).includes(letter);
  };

  const getQuestionOptions = (questionItem) => {
    if (!questionItem) return [];
    if (Array.isArray(questionItem.options) && questionItem.options.length > 0) {
      return questionItem.options.map((opt, idx) => ({
        letter: String.fromCharCode(65 + idx),
        text: typeof opt === 'string' ? opt : (opt?.text || String(opt || ''))
      }));
    }
    const legacy = [
      { letter: 'A', text: questionItem.opt_a || questionItem.optA },
      { letter: 'B', text: questionItem.opt_b || questionItem.optB },
      { letter: 'C', text: questionItem.opt_c || questionItem.optC },
      { letter: 'D', text: questionItem.opt_d || questionItem.optD },
    ].filter(o => Boolean(o.text));
    return legacy;
  };

  const selectAnswer = (questionItem, letter) => {
    if (!questionItem) return;
    const qId = questionItem.id;
    const isMulti = Boolean(
      questionItem.isMulti ||
      String(questionItem.correct || '').includes(',') ||
      (Array.isArray(questionItem.correct) && questionItem.correct.length > 1)
    );

    setAnswers(prev => {
      if (isMulti) {
        const currentAns = prev[qId];
        let list = [];
        if (Array.isArray(currentAns)) {
          list = [...currentAns];
        } else if (currentAns) {
          list = String(currentAns).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        }

        if (list.includes(letter)) {
          list = list.filter(l => l !== letter);
        } else {
          list = [...list, letter].sort();
        }

        if (list.length === 0) {
          const next = { ...prev };
          delete next[qId];
          return next;
        }
        return { ...prev, [qId]: list.join(',') };
      } else {
        if (prev[qId] === letter) {
          const next = { ...prev };
          delete next[qId];
          return next;
        }
        return { ...prev, [qId]: letter };
      }
    });
  };

  const handleSubmit = async () => {
    let subRes = null;
    try {
      subRes = await api.submitExam({
        examId: currentExam?.id,
        answers,
        autoSubmitted: false,
        violationsCount,
      });
    } catch {}
    const isLive = subRes?.live_result ?? (currentExam?.live_result ?? currentExam?.liveResult ?? false);
    navigate('/student/result', {
      state: {
        answers,
        questions,
        exam: currentExam,
        submission: subRes,
        liveResult: Boolean(isLive)
      }
    });
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
  const qOptions = getQuestionOptions(q);
  const isMulti = Boolean(
    q?.isMulti ||
    String(q?.correct || '').includes(',') ||
    (Array.isArray(q?.correct) && q?.correct.length > 1)
  );

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
            <div className="flex gap-2 exam-topbar-left" style={{ alignItems: 'center' }}>
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
            <div className="flex gap-2 exam-topbar-right" style={{ alignItems: 'center' }}>
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
              <button 
                type="button"
                className="btn btn-ghost btn-sm mobile-palette-btn"
                onClick={() => setShowMobileNav(prev => !prev)}
                title="Open question palette"
              >
                Q {current + 1}/{questions.length}
              </button>
              <ThemeToggle showLabel={false} />
              <button className="btn btn-primary btn-sm" onClick={() => setConfirmSubmit(true)}>
                Submit
              </button>
            </div>
          </div>

          <div className="exam-body">
            {!q ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <h3 style={{ fontSize: 18, color: 'var(--text-main)', marginBottom: 8 }}>No Questions Configured</h3>
                <p>Questions have not been added to this examination yet. Please contact the invigilator.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div className="question-count" style={{ margin: 0 }}>
                    Question {current + 1} of {questions.length}
                  </div>
                  {isMulti ? (
                    <span className="badge badge-yellow" style={{ fontSize: 11.5, padding: '3px 10px', fontWeight: 600 }}>
                      Multiple Answers (Select all that apply)
                    </span>
                  ) : (
                    <span className="badge badge-blue" style={{ fontSize: 11, padding: '3px 8px' }}>
                      Single Choice
                    </span>
                  )}
                </div>

                <QuestionDisplay text={q?.text} />

                <div className="options-list">
                  {qOptions.map(opt => {
                    const isSelected = isOptionSelected(q?.id, opt.letter);
                    return (
                      <div
                        key={opt.letter}
                        className={`option-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => selectAnswer(q, opt.letter)}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      >
                        <div
                          className="option-letter"
                          style={isMulti ? { borderRadius: 6, fontWeight: 700 } : {}}
                        >
                          {isSelected && isMulti ? '✓' : opt.letter}
                        </div>
                        <div className="option-text" style={{ flex: 1 }}>{opt.text}</div>
                        {isMulti && (
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                              background: isSelected ? 'var(--primary)' : 'transparent',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              marginLeft: 8,
                              flexShrink: 0
                            }}
                          >
                            {isSelected ? '✓' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

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

        {/* Mobile backdrop for question nav drawer */}
        {showMobileNav && (
          <div
            className="sidebar-backdrop"
            onClick={() => setShowMobileNav(false)}
            aria-hidden="true"
          />
        )}

        {/* Question nav sidebar */}
        <div className={`question-nav ${showMobileNav ? 'mobile-open' : ''}`}>
          <div className="flex-between mb-2">
            <div className="nav-title" style={{ margin: 0 }}>Questions ({questions.length})</div>
            <button
              type="button"
              className="btn btn-ghost btn-sm mobile-close-nav-btn"
              onClick={() => setShowMobileNav(false)}
              aria-label="Close question palette"
              style={{ padding: '2px 6px' }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
          <div className="q-grid">
            {questions.map((question, i) => {
              const ans = answers[question.id];
              const isCurrent = i === current;
              const cls = isCurrent ? 'current' : ans ? 'answered' : '';
              return (
                <div
                  key={question.id}
                  className={`q-dot ${cls}`}
                  onClick={() => {
                    setCurrent(i);
                    setShowMobileNav(false);
                  }}
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
