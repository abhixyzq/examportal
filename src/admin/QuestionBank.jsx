import { useState } from 'react';
import { DEMO_QUESTIONS } from '../data/demo';
import { UploadIcon, PlusIcon, CloseIcon, TrashIcon } from '../components/Icons';

const EMPTY = { text: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', subject: '', difficulty: 'easy' };

export default function QuestionBank() {
  const [questions, setQuestions] = useState(DEMO_QUESTIONS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');

  const filtered = questions.filter(q =>
    q.text.toLowerCase().includes(search.toLowerCase()) ||
    q.subject.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e) => {
    e.preventDefault();
    const newQ = { ...form, id: Date.now() };
    setQuestions(prev => [newQ, ...prev]);
    setForm(EMPTY);
    setShowForm(false);
  };

  const handleDelete = (id) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">Question Bank</div>
          <div className="page-sub">{questions.length} questions total</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm">
            <UploadIcon size={14} /> Import CSV
          </button>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['A','B','C','D'].map(opt => (
                <div className="form-group" key={opt}>
                  <label className="form-label">Option {opt}</label>
                  <input className="form-control" placeholder={`Option ${opt}`} value={form[`opt${opt}`]} onChange={e => setForm(f => ({ ...f, [`opt${opt}`]: e.target.value }))} required />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Correct Answer</label>
                <select className="form-control" value={form.correct} onChange={e => setForm(f => ({ ...f, correct: e.target.value }))}>
                  {['A','B','C','D'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-control" placeholder="e.g. Math" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Difficulty</label>
                <select className="form-control" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option>easy</option><option>medium</option><option>hard</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit">Save Question</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex-between mb-3">
          <input className="form-control" style={{ maxWidth: 280 }} placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} results</div>
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
              {filtered.map((q, i) => (
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
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No questions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
