import { useLocation, useNavigate } from 'react-router-dom';

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const answers = state?.answers || {};
  const autoSubmit = state?.autoSubmit;
  const questions = state?.questions || [];

  const correct = questions.filter(q => (answers[q.id] || '').toUpperCase() === (q.correct || '').toUpperCase()).length;
  const total = questions.length || 1;
  const score = questions.length > 0 ? Math.round((correct / total) * 100) : 0;
  const pass = score >= 60;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
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
              const isCorrect = (selected || '').toUpperCase() === (q.correct || '').toUpperCase();
              return (
                <div key={q.id} style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${!selected ? 'var(--border)' : isCorrect ? 'var(--success)' : 'var(--danger)'}` }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                    Q{i + 1}. {q.text}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Your answer: <strong style={{ color: selected ? (isCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)' }}>{selected || 'Not answered'}</strong></span>
                    {!isCorrect && <span>Correct: <strong style={{ color: 'var(--success)' }}>{q.correct}</strong></span>}
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
