import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { AlertTriangleIcon } from '../components/Icons';
import { api } from '../services/api';

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
  const [role, setRole] = useState('student');
  const [rollNo, setRollNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (role === 'student') {
        if (!rollNo.trim()) {
          setError('Please enter your Exam Roll Number');
          setLoading(false);
          return;
        }

        try {
          const res = await api.studentLogin(rollNo);
          if (res?.user && res?.token) {
            login(res.user, res.token);
            navigate('/student');
            setLoading(false);
            return;
          }
        } catch (apiErr) {
          setError(apiErr.message || 'Roll number not verified. Only candidates who filled the examination form are allowed.');
          setLoading(false);
          return;
        }
      } else {
        // Admin Login
        try {
          const res = await api.login(email, password, 'admin');
          if (res?.user && res?.token) {
            login(res.user, res.token);
            navigate('/admin');
            setLoading(false);
            return;
          }
        } catch (apiErr) {
          setError(apiErr.message || 'Invalid Admin credentials. Please check email and password.');
          setLoading(false);
          return;
        }
      }
    } catch {
      setError('Login failed. Please check credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="flex-between mb-1" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="login-title">Exam<span style={{ color: 'var(--primary)' }}>Portal</span></div>
            <div className="login-sub" style={{ marginBottom: 20 }}>
              {role === 'student' ? 'Candidate Exam Verification' : 'Invigilator & Admin Sign In'}
            </div>
          </div>
          <ThemeToggle showLabel={false} />
        </div>

        <div className="flex gap-2 mb-3">
          <button
            className={`btn w-full ${role === 'student' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setRole('student'); setError(''); }}
          >Student Candidate</button>
          <button
            className={`btn w-full ${role === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setRole('admin'); setError(''); }}
          >Admin / Invigilator</button>
        </div>

        <form onSubmit={handleSubmit}>
          {role === 'student' ? (
            <div className="form-group">
              <label className="form-label">Exam Roll Number</label>
              <input
                className="form-control"
                type="text"
                placeholder="e.g. 2026-CS-101"
                value={rollNo}
                onChange={e => setRollNo(e.target.value)}
                autoFocus
                required
                style={{ fontSize: 16, letterSpacing: '0.5px', textTransform: 'uppercase' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Only pre-registered candidates who filled the examination form are allowed.
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Admin Email</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="admin@exam.com"
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
            </>
          )}

          {error && (
            <div style={{ 
              color: 'var(--danger)', 
              fontSize: 13, 
              marginBottom: 14, 
              background: 'rgba(239, 68, 68, 0.1)', 
              padding: '8px 12px', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ height: 42 }}>
            {loading ? 'Verifying...' : (role === 'student' ? 'Verify & Enter Exam Portal' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}
