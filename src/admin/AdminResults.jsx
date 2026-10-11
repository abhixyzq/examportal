import { DEMO_EXAMS, DEMO_STUDENTS } from '../data/demo';
import { DownloadIcon } from '../components/Icons';

const results = DEMO_STUDENTS.map((s, i) => ({
  ...s,
  score: Math.floor(Math.random() * 100),
  rank: i + 1,
  exam: 'Physics Mid-Term',
})).sort((a, b) => b.score - a.score).map((s, i) => ({ ...s, rank: i + 1 }));

export default function AdminResults() {
  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">Results</div>
          <div className="page-sub">View and export exam results</div>
        </div>
        <button className="btn btn-ghost btn-sm">
          <DownloadIcon size={14} /> Export CSV
        </button>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value">{Math.round(results.reduce((a, b) => a + b.score, 0) / results.length)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Highest Score</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{Math.max(...results.map(r => r.score))}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Appeared</div>
          <div className="stat-value">{results.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-3">
          <div style={{ fontWeight: 600, fontSize: 14 }}>Rank List</div>
          <select className="form-control" style={{ width: 200 }}>
            {DEMO_EXAMS.map(e => <option key={e.id}>{e.title}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Email</th>
                <th>Score</th>
                <th>Answered</th>
                <th>Violations</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#9ca3af' : r.rank === 3 ? '#b45309' : 'var(--text-muted)'
                    }}>
                      #{r.rank}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{r.email}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: r.score >= 60 ? 'var(--success)' : 'var(--danger)' }}>
                      {r.score}%
                    </span>
                  </td>
                  <td>{r.answered}/{r.total}</td>
                  <td>
                    <span className={`badge ${r.violations > 0 ? 'badge-red' : 'badge-green'}`}>
                      {r.violations}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${r.score >= 60 ? 'badge-green' : 'badge-red'}`}>
                      {r.score >= 60 ? 'Pass' : 'Fail'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
