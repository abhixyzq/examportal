import { useLocation, useNavigate } from 'react-router-dom';
import QuestionDisplay from '../components/QuestionDisplay';
import { CheckIcon } from '../components/Icons';

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const answers = state?.answers || {};
  const autoSubmit = state?.autoSubmit;
  const questions = state?.questions || [];
  const exam = state?.exam;

  const isLiveResult = Boolean(
    state?.liveResult !== undefined
      ? state.liveResult
      : (exam?.live_result ?? exam?.liveResult ?? false)
  );

  const normalize = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(s => String(s).trim().toUpperCase()).filter(Boolean).sort();
    return String(val).split(',').map(s => s.trim().toUpperCase()).filter(Boolean).sort();
  };

  const isMatch = (selected, correctVal) => {
    const s = normalize(selected);
    const c = normalize(correctVal);
    if (s.length === 0 || c.length === 0 || s.length !== c.length) return false;
    return s.every((v, i) => v === c[i]);
  };

  const correct = questions.filter(q => isMatch(answers[q.id], q.correct)).length;
  const total = questions.length || 1;
  const score = questions.length > 0 ? Math.round((correct / total) * 100) : 0;
  const pass = score >= 60;

  // 1. If Live Result is DISABLED by Admin, show secure submission confirmation
  if (!isLiveResult) {
    return (
      <div style={{ maxWidth: 540, margin: '20px auto 0 auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '36px 28px' }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              border: '2px solid var(--success)'
            }}
          >
            <CheckIcon size={36} />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
            Exam Submitted Successfully!
          </h2>

          {autoSubmit && (
            <div style={{ marginBottom: 14 }}>
              <span className="badge badge-red" style={{ fontSize: 11.5, padding: '3px 10px' }}>
                Auto-submitted due to proctoring policy
              </span>
            </div>
          )}

          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 22 }}>
            Your exam answers have been securely recorded and locked in the system.
          </p>

          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              textAlign: 'left',
              marginBottom: 20
            }}
          >
            <div className="meta-row mb-2">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Examination:</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{exam?.title || 'Examination'}</span>
            </div>
            <div className="meta-row mb-2">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Questions Attempted:</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                {Object.keys(answers).length} of {questions.length}
              </span>
            </div>
            <div className="meta-row">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Result Status:</span>
              <span className="badge badge-yellow" style={{ fontSize: 11.5 }}>
                Under Evaluation (Live Results Off)
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: 12.5,
              color: 'var(--text-muted)',
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              marginBottom: 24,
              lineHeight: 1.5,
              textAlign: 'left'
            }}
          >
            ℹ️ <strong>Live Result Notice:</strong> Immediate score publication is turned off for this examination by the invigilator. Official results and scorecards will be published after review.
          </div>

          <button
            type="button"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 14 }}
            onClick={() => navigate('/student')}
          >
            ← Return to Student Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 2. If Live Result is ENABLED, show immediate score and question review
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-title">Exam Result</div>
        {autoSubmit && <div className="page-sub" style={{ color: 'var(--danger)' }}>Auto-submitted due to violations</div>}
      </div>

      <div className="card mb-3" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -2, color: pass ? 'var(--success)' : 'var(--danger)' }}>
          {score}%
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          {correct} correct out of {questions.length} questions
        </div>
        <div className="mt-2">
          <span className={`badge ${pass ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 13, padding: '4px 14px' }}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
        </div>
      </div>

      {questions.length > 0 && (
        <div className="card mb-3">
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Question Review</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.map((q, i) => {
              const selected = answers[q.id];
              const isCorrect = isMatch(selected, q.correct);
              const selectedText = normalize(selected).join(', ');
              const correctText = normalize(q.correct).join(', ');

              return (
                <div key={q.id} style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${!selected ? 'var(--border)' : isCorrect ? 'var(--success)' : 'var(--danger)'}` }}>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-sub)' }}>Q{i + 1}. </span>
                    <QuestionDisplay text={q.text} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Your answer: <strong style={{ color: selected ? (isCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)' }}>{selectedText || 'Not answered'}</strong></span>
                    {!isCorrect && <span>Correct: <strong style={{ color: 'var(--success)' }}>{correctText}</strong></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button className="btn btn-ghost" onClick={() => navigate('/student')}>← Back to Dashboard</button>
    </div>
  );
}
