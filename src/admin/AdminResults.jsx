import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DownloadIcon } from '../components/Icons';

export default function AdminResults() {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getExams().then(examList => {
      setExams(examList || []);
      if (examList?.length > 0) {
        setSelectedExamId(examList[0].id);
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    setLoading(true);
    api.getExamResults(selectedExamId).then(data => {
      setResults(data || []);
      setLoading(false);
    }).catch(() => {
      setResults([]);
      setLoading(false);
    });
  }, [selectedExamId]);

  const avgScore = results.length > 0
    ? Math.round(results.reduce((a, b) => a + (b.percentage || b.score || 0), 0) / results.length)
    : 0;

  const highestScore = results.length > 0
    ? Math.max(...results.map(r => r.percentage || r.score || 0))
    : 0;

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">Results</div>
          <div className="page-sub">Official candidate results and merit rankings</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value">{avgScore}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Highest Score</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{highestScore}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Appeared</div>
          <div className="stat-value">{results.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-3" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Rank List</div>
          {exams.length > 0 && (
            <select
              className="form-control"
              style={{ width: 220 }}
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate Name</th>
                <th>Roll Number</th>
                <th>Score</th>
                <th>Violations</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    Loading results...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                    No exam submissions recorded yet. Results will appear here once candidates submit their exams.
                  </td>
                </tr>
              ) : (
                results.map((r, i) => (
                  <tr key={r.id || i}>
                    <td style={{ fontWeight: 700, color: i === 0 ? 'var(--primary)' : 'inherit' }}>#{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{r.user_name || r.name}</td>
                    <td><span className="badge badge-purple">{r.roll_no || 'N/A'}</span></td>
                    <td style={{ fontWeight: 600 }}>{r.percentage || r.score}%</td>
                    <td>
                      <span style={{ color: (r.violations_count || r.violations) > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {r.violations_count || r.violations || 0}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.passed ? 'badge-green' : 'badge-red'}`}>
                        {r.passed ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
