import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStoredExams } from '../data/demo';
import { LockIcon, KeyIcon, CloseIcon } from '../components/Icons';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const exams = getStoredExams();

  const [codeModalExam, setCodeModalExam] = useState(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleStartExam = (exam) => {
    if (user?.exam_id && Number(user.exam_id) !== Number(exam.id)) {
      alert(`You are enrolled for a different examination. Access to "${exam.title}" is restricted.`);
      return;
    }

    if (exam.requireCode) {
      // Check if already authenticated this session
      const isAuth = sessionStorage.getItem(`ep_exam_auth_${exam.id}`) === 'true';
      if (isAuth) {
        navigate(`/student/exam/${exam.id}`);
        return;
      }
      setCodeModalExam(exam);
      setEnteredCode('');
      setCodeError('');
    } else {
      navigate(`/student/exam/${exam.id}`);
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (!codeModalExam) return;

    const targetCode = (codeModalExam.accessCode || '').trim().toUpperCase();
    const inputCode = enteredCode.trim().toUpperCase();

    if (inputCode === targetCode) {
      sessionStorage.setItem(`ep_exam_auth_${codeModalExam.id}`, 'true');
      const examId = codeModalExam.id;
      setCodeModalExam(null);
      navigate(`/student/exam/${examId}`);
    } else {
      setCodeError('Invalid access code. Please check with your invigilator in the exam hall.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
          <div className="page-title">Hello, {user?.name}</div>
          {user?.roll_no && (
            <span className="badge badge-purple" style={{ fontFamily: 'monospace', fontSize: 13 }}>
              Roll: {user.roll_no}
            </span>
          )}
        </div>
        <div className="page-sub">Verified Candidate &bull; Your eligible exams are listed below</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
        {exams.map(exam => (
          <div key={exam.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{exam.title}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{exam.subject}</span>
                <span>{exam.duration} min</span>
                <span>{exam.total} questions</span>
                <span>{exam.date} {exam.time}</span>
              </div>
            </div>
            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              {exam.requireCode && (
                <span className="badge badge-yellow" style={{ fontSize: 11, gap: 4 }}>
                  <LockIcon size={11} /> Code Protected
                </span>
              )}
              {exam.proctored && <span className="badge badge-yellow" style={{ fontSize: 11 }}>Proctored</span>}
              <span className={`badge ${exam.status === 'active' ? 'badge-green' : exam.status === 'upcoming' ? 'badge-blue' : 'badge-gray'}`}>
                {exam.status}
              </span>
              {exam.status === 'active' && (
                <button className="btn btn-primary btn-sm" onClick={() => handleStartExam(exam)}>
                  Start Exam
                </button>
              )}
              {exam.status === 'completed' && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/results')}>
                  View Result
                </button>
              )}
              {exam.status === 'upcoming' && (
                <button className="btn btn-ghost btn-sm" disabled style={{ opacity: 0.5 }}>Upcoming</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Access Code Verification Modal */}
      {codeModalExam && (
        <div className="violation-overlay" onClick={() => setCodeModalExam(null)}>
          <div className="violation-box" style={{ maxWidth: 380, textAlign: 'left' }} onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
                <KeyIcon size={16} /> Exam Hall Access Code
              </div>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => setCodeModalExam(null)}
              >
                <CloseIcon size={13} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              This exam is protected. Please enter the passcode provided by the invigilator inside your exam hall to unlock <strong>{codeModalExam.title}</strong>.
            </div>

            <form onSubmit={handleVerifyCode}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Access Passcode</label>
                <input
                  className="form-control"
                  placeholder="e.g. PHYS90"
                  value={enteredCode}
                  onChange={e => {
                    setEnteredCode(e.target.value.toUpperCase());
                    setCodeError('');
                  }}
                  autoFocus
                  required
                  style={{
                    letterSpacing: '3px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    fontSize: 16,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                  }}
                />
              </div>

              {codeError && (
                <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 14 }}>
                  {codeError}
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
                  Verify & Enter
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  style={{ justifyContent: 'center' }}
                  onClick={() => setCodeModalExam(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
