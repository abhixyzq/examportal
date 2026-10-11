import { useState, useEffect } from 'react';
import { CloseIcon, ShieldIcon } from '../components/Icons';
import { getSocket } from '../services/socket';
import { api } from '../services/api';

const VIOLATION_NAMES = {
  tab_switch: 'Tab Switch',
  window_blur: 'Focus Lost',
  right_click: 'Right Click',
  screenshot_attempt: 'Screenshot',
  fullscreen_exit: 'Fullscreen Exit',
  devtools_open: 'DevTools',
};

export default function LiveMonitor() {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  // Real-time serverless polling + socket events
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await api.getLiveMonitor(2);
        if (data?.students) {
          setStudents(data.students);
        }
      } catch {}
    };

    fetchLive();
    const pollInterval = setInterval(fetchLive, 3500);

    const socket = getSocket();
    try {
      socket.emit('admin:subscribe', { examId: 2 });
    } catch {}

    socket.on('monitor:init', (data) => {
      if (data?.students) {
        setStudents(data.students);
      }
    });

    socket.on('monitor:heartbeat', (data) => {
      setStudents(prev => prev.map(s => s.id === data.studentId ? { ...s, answered: data.answered, timeLeft: data.timeLeft } : s));
    });

    socket.on('monitor:violation', (data) => {
      setStudents(prev => prev.map(s => s.id === data.studentId ? { ...s, violations: data.violations, status: data.status } : s));
    });

    socket.on('monitor:update', (data) => {
      if (data.type === 'student_joined' && data.student) {
        setStudents(prev => {
          const exists = prev.find(s => s.id === data.student.id);
          return exists ? prev.map(s => s.id === data.student.id ? data.student : s) : [data.student, ...prev];
        });
      }
    });

    return () => {
      clearInterval(pollInterval);
      try {
        socket.off('monitor:init');
        socket.off('monitor:heartbeat');
        socket.off('monitor:violation');
        socket.off('monitor:update');
      } catch {}
    };
  }, []);

  const filtered = students.filter(s => filter === 'all' ? true : s.status === filter);

  const forceSubmit = (id) => {
    try {
      const socket = getSocket();
      socket.emit('admin:terminate', { examId: 2, studentId: id, reason: 'Disqualified by Admin' });
    } catch {}
    api.disqualifyStudent(2, id).catch(() => {});
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status: 'disqualified' } : s));
    setSelected(null);
  };

  const stats = {
    active: students.filter(s => s.status === 'active').length,
    warning: students.filter(s => s.status === 'warning').length,
    danger: students.filter(s => s.status === 'danger').length,
  };

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">Live Monitor</div>
          <div className="page-sub">{students.length} students in exam · updates every 3s</div>
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: `Active (${stats.active})` },
            { key: 'warning', label: `Warning (${stats.warning})` },
            { key: 'danger', label: `Flagged (${stats.danger})` },
          ].map(f => (
            <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          No candidates currently active in the examination room.
        </div>
      ) : (
        <div className="monitor-grid">
          {filtered.map(s => (
            <div
              key={s.id}
              className={`student-card ${s.status === 'warning' ? 'warning' : s.status === 'danger' ? 'danger' : ''}`}
              onClick={() => setSelected(s)}
              style={{ cursor: 'pointer' }}
            >
              <div className="flex-between">
                <div className="student-name">{s.name}</div>
                <span className={`badge ${s.status === 'active' ? 'badge-green' : s.status === 'warning' ? 'badge-yellow' : s.status === 'danger' ? 'badge-red' : 'badge-gray'}`}>
                  {s.status}
                </span>
              </div>
              <div className="student-meta">
                <div className="meta-row">
                  <span>Progress</span>
                  <span className="meta-val">{s.answered}/{s.total}</span>
                </div>
                <div style={{ margin: '6px 0 2px', height: 3, background: 'var(--border)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${(s.answered / s.total) * 100}%`, background: 'var(--primary)', borderRadius: 2, transition: 'width 0.4s' }} />
                </div>
                <div className="meta-row" style={{ marginTop: 6 }}>
                  <span>Time Left</span>
                  <span className="meta-val">{s.timeLeft}</span>
                </div>
                <div className="meta-row">
                  <span>Violations</span>
                  <span className="meta-val" style={{ color: s.violations > 0 ? 'var(--danger)' : 'var(--text-sub)' }}>
                    {s.violations}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Detail Modal */}
      {selected && (
        <div className="violation-overlay" onClick={() => setSelected(null)}>
          <div className="violation-box" style={{ maxWidth: 380, textAlign: 'left' }} onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-2">
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.name}</div>
              <button className="btn btn-icon btn-sm" onClick={() => setSelected(null)}>
                <CloseIcon size={14} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{selected.email}</div>

            <div className="divider" style={{ margin: '0 0 14px' }} />

            <div className="student-meta">
              {[
                ['Progress', `${selected.answered}/${selected.total}`],
                ['Time Left', selected.timeLeft],
                ['Violations', selected.violations],
                ['Status', selected.status],
              ].map(([k, v]) => (
                <div className="meta-row" key={k} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{k}</span>
                  <span className="meta-val">{v}</span>
                </div>
              ))}
            </div>

            <div className="divider" style={{ margin: '14px 0' }} />

            <div className="flex gap-2">
              <button className="btn btn-danger w-full" onClick={() => forceSubmit(selected.id)}>
                Force Submit
              </button>
              <button className="btn btn-ghost w-full" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
