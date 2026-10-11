import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { AlertTriangleIcon } from '../components/Icons';

const VIOLATION_LABELS = {
  tab_switch: 'Tab Switch Detected',
  window_blur: 'Window Focus Lost',
  right_click: 'Right Click Blocked',
  copy_paste: 'Copy / Paste Attempt Blocked',
  unauthorized_shortcut: 'Prohibited Key Shortcut',
  screenshot_attempt: 'Screenshot Attempt Detected',
  fullscreen_exit: 'Exited Fullscreen Mode',
  devtools_open: 'Developer Tools / Inspection Blocked',
};

export function ViolationWarning({ type, remaining, onDismiss, onReenter }) {
  return (
    <div className="violation-overlay">
      <div className="violation-box">
        <div className="violation-icon"><AlertTriangleIcon size={32} /></div>
        <div className="violation-title">{VIOLATION_LABELS[type] || 'Violation'}</div>
        <div className="violation-text">
          This activity is not allowed during the exam.
          {remaining > 0
            ? ` You have ${remaining} warning${remaining > 1 ? 's' : ''} remaining.`
            : ' This was your final warning.'}
        </div>
        <button className="btn btn-primary w-full" onClick={() => { if (onReenter) onReenter(); onDismiss(); }}>
          Return to Exam
        </button>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Demo credentials
      if (role === 'admin' && email === 'admin@exam.com' && password === 'admin123') {
        login({ id: 1, name: 'Admin', email, role: 'admin' }, 'demo-admin-token');
        navigate('/admin');
      } else if (role === 'student' && email && password === 'student123') {
        login({ id: 2, name: email.split('@')[0], email, role: 'student' }, 'demo-student-token');
        navigate('/student');
      } else {
        setError('Invalid credentials');
      }
    } catch {
      setError('Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="flex-between mb-1" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="login-title">Exam<span style={{ color: 'var(--primary)' }}>Portal</span></div>
            <div className="login-sub" style={{ marginBottom: 20 }}>Sign in to continue</div>
          </div>
          <ThemeToggle showLabel={false} />
        </div>

        <div className="flex gap-2 mb-3">
          <button
            className={`btn w-full ${role === 'student' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setRole('student')}
          >Student</button>
          <button
            className={`btn w-full ${role === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setRole('admin')}
          >Admin</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-control"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-muted)' }}>
          <div><strong style={{ color: 'var(--text-sub)' }}>Demo Admin:</strong> admin@exam.com / admin123</div>
          <div style={{ marginTop: 4 }}><strong style={{ color: 'var(--text-sub)' }}>Demo Student:</strong> any email / student123</div>
        </div>
      </div>
    </div>
  );
}
