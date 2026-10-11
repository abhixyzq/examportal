import { useState, useEffect } from 'react';
import { getStoredExams, saveStoredExams } from '../data/demo';
import { PlusIcon, CloseIcon, TrashIcon, LockIcon, KeyIcon } from '../components/Icons';
import { api } from '../services/api';

const generateRandomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

const EMPTY_EXAM = {
  title: '', subject: '', duration: 60, date: '', time: '',
  total: 20, proctored: true, liveResult: false, shuffleQ: true,
  shuffleOpt: true, maxViolations: 3,
  requireCode: true, accessCode: '',
};

export default function ExamManager() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => ({
    ...EMPTY_EXAM,
    accessCode: generateRandomCode(),
  }));

  const loadExams = async () => {
    try {
      const data = await api.getExams();
      if (Array.isArray(data)) {
        setExams(data);
        saveStoredExams(data);
        setLoading(false);
        return;
      }
    } catch {}
    const local = getStoredExams();
    setExams(local || []);
    setLoading(false);
  };

  useEffect(() => {
    loadExams();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    const finalCode = form.requireCode ? (form.accessCode.trim() || generateRandomCode()) : '';
    const newExam = {
      ...form,
      accessCode: finalCode,
      duration_mins: form.duration,
      total_questions: form.total,
    };

    try {
      const res = await api.createExam(newExam);
      if (res?.id) {
        loadExams();
        setShowForm(false);
        setForm({ ...EMPTY_EXAM, accessCode: generateRandomCode() });
        return;
      }
    } catch {}

    const localExam = { ...newExam, id: Date.now(), status: 'active' };
    const updated = [localExam, ...exams];
    setExams(updated);
    saveStoredExams(updated);
    setForm({ ...EMPTY_EXAM, accessCode: generateRandomCode() });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) return;
    try {
      await api.deleteExam(id);
    } catch {}
    const updated = exams.filter(e => e.id !== id);
    setExams(updated);
    saveStoredExams(updated);
  };

  const toggleLiveResult = async (id) => {
    try {
      await api.toggleLiveResult(id);
    } catch {}
    const updated = exams.map(e => e.id === id ? { ...e, liveResult: !e.liveResult, live_result: !e.live_result } : e);
    setExams(updated);
    saveStoredExams(updated);
  };

  const toggleRequireCode = (id) => {
    const updated = exams.map(e => {
      if (e.id === id) {
        const next = !e.requireCode;
        return {
          ...e,
          requireCode: next,
          accessCode: next ? (e.accessCode || generateRandomCode()) : e.accessCode,
        };
      }
      return e;
    });
    setExams(updated);
    saveStoredExams(updated);
  };

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">Exam Manager</div>
          <div className="page-sub">{exams.length} exams configured</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? <><CloseIcon size={14} /> Cancel</> : <><PlusIcon size={14} /> New Exam</>}
        </button>
      </div>

      {showForm && (
        <div className="card mb-3">
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>Create Exam</div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Exam Title</label>
                <input className="form-control" placeholder="e.g. Math Mid-Term" value={form.title} onChange={e => set('title', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-control" placeholder="e.g. Mathematics" value={form.subject} onChange={e => set('subject', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input className="form-control" type="number" min={5} value={form.duration} onChange={e => set('duration', +e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Total Questions</label>
                <input className="form-control" type="number" min={1} value={form.total} onChange={e => set('total', +e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-control" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="form-control" type="time" value={form.time} onChange={e => set('time', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Max Violations (before auto-submit)</label>
                <input className="form-control" type="number" min={1} max={10} value={form.maxViolations} onChange={e => set('maxViolations', +e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '8px 0 14px' }}>
              {[
                { key: 'requireCode', label: 'Require Hall Access Code' },
                { key: 'proctored', label: 'Proctoring' },
                { key: 'liveResult', label: 'Live Results' },
                { key: 'shuffleQ', label: 'Shuffle Questions' },
                { key: 'shuffleOpt', label: 'Shuffle Options' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => {
                        const val = e.target.checked;
                        set(key, val);
                        if (key === 'requireCode' && val && !form.accessCode) {
                          set('accessCode', generateRandomCode());
                        }
                      }}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{label}</span>
                </div>
              ))}
            </div>

            {form.requireCode && (
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, border: '1px solid var(--border)' }}>
                <div className="flex-between mb-1">
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LockIcon size={13} /> Exam Hall Access Code
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => set('accessCode', generateRandomCode())}
                  >
                    Generate Random Code
                  </button>
                </div>
                <input
                  className="form-control"
                  placeholder="e.g. HALL26 or 482910"
                  value={form.accessCode}
                  onChange={e => set('accessCode', e.target.value.toUpperCase())}
                  required={form.requireCode}
                  style={{ letterSpacing: '2px', fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase', maxWidth: 260 }}
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  Students must enter this passcode to access the exam. Share this only with invigilators inside the physical exam hall.
                </div>
              </div>
            )}

            <button className="btn btn-primary" type="submit">Create Exam</button>
          </form>
        </div>
      )}

      <div className="card">
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
                <th>Hall Access Code</th>
                <th>Proctored</th>
                <th>Live Results</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No examinations created yet. Click "+ Create Exam" above to schedule an exam.
                  </td>
                </tr>
              ) : (
                exams.map(exam => (
                <tr key={exam.id}>
                  <td style={{ fontWeight: 500 }}>{exam.title}</td>
                  <td>{exam.subject}</td>
                  <td style={{ color: 'var(--text-sub)' }}>{exam.date} {exam.time}</td>
                  <td>{exam.duration}m</td>
                  <td>{exam.total}</td>
                  <td>
                    <span className={`badge ${exam.status === 'active' ? 'badge-green' : exam.status === 'upcoming' ? 'badge-blue' : 'badge-gray'}`}>
                      {exam.status}
                    </span>
                  </td>
                  <td>
                    {exam.requireCode ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="badge badge-yellow" style={{ fontFamily: 'monospace', letterSpacing: 1, fontWeight: 700, gap: 5 }}>
                          <LockIcon size={11} /> {exam.accessCode}
                        </span>
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          style={{ padding: '3px 6px', fontSize: 10 }}
                          title="Remove code requirement"
                          onClick={() => toggleRequireCode(exam.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => toggleRequireCode(exam.id)}
                      >
                        + Add Code
                      </button>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${exam.proctored ? 'badge-yellow' : 'badge-gray'}`}>
                      {exam.proctored ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={exam.liveResult} onChange={() => toggleLiveResult(exam.id)} />
                      <span className="toggle-slider" />
                    </label>
                  </td>
                  <td>
                    <button className="btn btn-icon btn-sm" onClick={() => handleDelete(exam.id)} title="Delete">
                      <TrashIcon size={14} />
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
