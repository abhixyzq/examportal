import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AdminDashboard() {
  const [exams, setExams] = useState([]);
  const [candidateCount, setCandidateCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getExams().catch(() => []),
      api.getCandidates().catch(() => []),
    ]).then(([examList, candList]) => {
      setExams(examList || []);
      setCandidateCount(candList?.length || 0);
      setLoading(false);
    });
  }, []);

  const active = exams.filter(e => e.status === 'active').length;
  const upcoming = exams.filter(e => e.status === 'upcoming').length;
  const completed = exams.filter(e => e.status === 'completed').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Overview of examination activity</div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Active Exams</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Upcoming</div>
          <div className="stat-value">{upcoming}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Enrolled Candidates</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{candidateCount}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-2">
          <div style={{ fontWeight: 600, fontSize: 14 }}>All Scheduled Exams</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Date & Time</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Proctored</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    Loading exams...
                  </td>
                </tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No examinations created yet. Go to <strong>Exams</strong> to create your first exam.
                  </td>
                </tr>
              ) : (
                exams.map(exam => (
                  <tr key={exam.id}>
                    <td style={{ fontWeight: 500 }}>{exam.title}</td>
                    <td>{exam.subject}</td>
                    <td>{exam.date} {exam.time}</td>
                    <td>{exam.duration_mins || exam.duration} min</td>
                    <td>{exam.total_questions || exam.total}</td>
                    <td>
                      <span className={`badge ${exam.status === 'active' ? 'badge-green' : exam.status === 'upcoming' ? 'badge-blue' : 'badge-gray'}`}>
                        {exam.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${exam.proctored ? 'badge-yellow' : 'badge-gray'}`}>
                        {exam.proctored ? 'Yes' : 'No'}
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
