import { DEMO_EXAMS, DEMO_STUDENTS } from '../data/demo';

export default function AdminDashboard() {
  const active = DEMO_EXAMS.filter(e => e.status === 'active').length;
  const upcoming = DEMO_EXAMS.filter(e => e.status === 'upcoming').length;
  const completed = DEMO_EXAMS.filter(e => e.status === 'completed').length;
  const liveStudents = DEMO_STUDENTS.length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Overview of all exam activity</div>
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
          <div className="stat-label">Live Students</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{liveStudents}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-2">
          <div style={{ fontWeight: 600, fontSize: 14 }}>All Exams</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Proctored</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_EXAMS.map(exam => (
                <tr key={exam.id}>
                  <td style={{ fontWeight: 500 }}>{exam.title}</td>
                  <td>{exam.subject}</td>
                  <td>{exam.date} {exam.time}</td>
                  <td>{exam.duration} min</td>
                  <td>{exam.total}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
