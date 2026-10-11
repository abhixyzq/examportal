import { useNavigate } from 'react-router-dom';

const myResults = [
  { id: 1, exam: 'Chemistry Quiz', date: '2026-10-05', score: 78, total: 20, correct: 15, rank: 3, pass: true },
];

export default function MyResults() {
  const navigate = useNavigate();

  if (myResults.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">My Results</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No results yet
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">My Results</div>
        <div className="page-sub">{myResults.length} exam(s) completed</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
        {myResults.map(r => (
          <div key={r.id} className="card card-sm">
            <div className="flex-between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.exam}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.date} · {r.correct}/{r.total} correct · Rank #{r.rank}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: r.pass ? 'var(--success)' : 'var(--danger)' }}>
                  {r.score}%
                </div>
                <span className={`badge ${r.pass ? 'badge-green' : 'badge-red'}`}>
                  {r.pass ? 'Pass' : 'Fail'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
