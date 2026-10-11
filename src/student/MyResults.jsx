import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function MyResults() {
  const [myResults, setMyResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyResults().then(data => {
      setMyResults(data || []);
      setLoading(false);
    }).catch(() => {
      setMyResults([]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">My Results</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Loading your exam results...
        </div>
      </div>
    );
  }

  if (myResults.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">My Results</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No examination results recorded yet.
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
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.exam_title || r.exam}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {r.submitted_at?.split('T')[0] || r.date} · {Boolean(r.live_result) ? `${r.score}/${r.total_questions || r.total} correct` : 'Submitted'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {Boolean(r.live_result) ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 22, color: r.passed ? 'var(--success)' : 'var(--danger)' }}>
                      {r.percentage || r.score}%
                    </div>
                    <span className={`badge ${r.passed ? 'badge-green' : 'badge-red'}`}>
                      {r.passed ? 'Passed' : 'Failed'}
                    </span>
                  </>
                ) : (
                  <span className="badge badge-yellow" style={{ fontSize: 11.5 }}>
                    Under Evaluation
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
