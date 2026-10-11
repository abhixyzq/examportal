import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { UploadIcon, PlusIcon, CloseIcon, TrashIcon } from '../components/Icons';

const EMPTY = { text: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', subject: '', difficulty: 'easy' };

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');

  const loadQuestions = async () => {
    try {
      const data = await api.getQuestions();
      setQuestions(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const filtered = questions.filter(q =>
    (q.text || '').toLowerCase().includes(search.toLowerCase()) ||
    (q.subject || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.addQuestion(form);
      loadQuestions();
      setForm(EMPTY);
      setShowForm(false);
    } catch (err) {
      alert(err.message || 'Failed to add question');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api.deleteQuestion(id);
      loadQuestions();
    } catch (err) {
      alert(err.message || 'Failed to delete question');
    }
  };

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">Question Bank</div>
          <div className="page-sub">{questions.length} questions total</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? <><CloseIcon size={14} /> Cancel</> : <><PlusIcon size={14} /> Add Question</>}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-3">
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>New Question</div>
          <form onSubmit={handleAdd}>
            <div className="form-group">
              <label className="form-label">Question Text</label>
              <textarea className="form-control" placeholder="Enter question..." value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} required />
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              {['A','B','C','D'].map(opt => (
                <div className="form-group" key={opt}>
                  <label className="form-label">Option {opt}</label>
                  <input className="form-control" placeholder={`Option ${opt}`} value={form[`opt${opt}`]} onChange={e => setForm(f => ({ ...f, [`opt${opt}`]: e.target.value }))} required />
                </div>
              ))}
            </div>
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Correct Option</label>
                <select className="form-control" value={form.correct} onChange={e => setForm(f => ({ ...f, correct: e.target.value }))}>
                  {['A','B','C','D'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-control" placeholder="e.g. Physics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Difficulty</label>
                <select className="form-control" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Question</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex-between mb-3">
          <input
            className="form-control"
            style={{ maxWidth: 300 }}
            placeholder="Search questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Question</th>
                <th>Subject</th>
                <th>Difficulty</th>
                <th>Correct</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading questions...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No questions in the question bank yet. Click "+ Add Question" to create one.</td></tr>
              ) : (
                filtered.map((q, i) => (
                  <tr key={q.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ maxWidth: 340 }}>{q.text}</td>
                    <td>{q.subject}</td>
                    <td>
                      <span className={`badge ${q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td><span className="badge badge-blue">{q.correct}</span></td>
                    <td>
                      <button className="btn btn-icon btn-sm" onClick={() => handleDelete(q.id)} title="Delete">
                        <TrashIcon size={14} />
                      </button>
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
