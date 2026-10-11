import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { PlusIcon, CloseIcon, TrashIcon, UploadIcon, ExamsIcon } from '../components/Icons';

export default function QuestionBank() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialExamId = searchParams.get('examId') || 'all';

  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(initialExamId);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkExamId, setBulkExamId] = useState(initialExamId !== 'all' ? initialExamId : '');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [search, setSearch] = useState('');

  const getEmptyForm = (examId) => {
    const targetExam = exams.find(e => String(e.id) === String(examId));
    return {
      text: '',
      optA: '',
      optB: '',
      optC: '',
      optD: '',
      correct: 'A',
      subject: targetExam ? targetExam.subject : '',
      difficulty: 'easy',
      exam_id: examId && examId !== 'all' ? String(examId) : ''
    };
  };

  const [form, setForm] = useState(() => getEmptyForm(initialExamId));

  const loadData = async () => {
    try {
      const [qData, exData] = await Promise.all([
        api.getQuestions(),
        api.getExams()
      ]);
      setQuestions(Array.isArray(qData) ? qData : []);
      setExams(Array.isArray(exData) ? exData : []);
    } catch (err) {
      console.error('Failed to load data in QuestionBank:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync selected exam from URL if search param changes
  useEffect(() => {
    const pId = searchParams.get('examId');
    if (pId) {
      setSelectedExam(pId);
      setBulkExamId(pId);
      setForm(prev => ({ ...prev, exam_id: pId }));
    }
  }, [searchParams]);

  // Handle changing the exam filter dropdown
  const handleExamFilterChange = (newExamId) => {
    setSelectedExam(newExamId);
    if (newExamId === 'all') {
      searchParams.delete('examId');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ examId: newExamId });
    }
    // Pre-populate new question form with the newly selected exam
    if (newExamId !== 'all' && newExamId !== 'unassigned') {
      const ex = exams.find(e => String(e.id) === String(newExamId));
      setForm(prev => ({
        ...prev,
        exam_id: newExamId,
        subject: ex ? ex.subject : prev.subject
      }));
      setBulkExamId(newExamId);
    }
  };

  const filtered = questions.filter(q => {
    if (selectedExam !== 'all') {
      if (selectedExam === 'unassigned') {
        if (q.exam_id) return false;
      } else {
        if (String(q.exam_id) !== String(selectedExam)) return false;
      }
    }
    const term = search.toLowerCase();
    const matchText = (q.text || '').toLowerCase().includes(term);
    const matchSubj = (q.subject || '').toLowerCase().includes(term);
    return matchText || matchSubj;
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        exam_id: form.exam_id ? Number(form.exam_id) : null
      };
      await api.addQuestion(payload);
      await loadData();
      setForm(getEmptyForm(selectedExam));
      setShowForm(false);
    } catch (err) {
      alert(err.message || 'Failed to add question');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question permanently?')) return;
    try {
      await api.deleteQuestion(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete question');
    }
  };

  // Bulk CSV parser
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setBulkLoading(true);

    try {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = [];

      for (const line of lines) {
        // Skip header lines
        if (line.toLowerCase().startsWith('question') || line.toLowerCase().startsWith('text,')) continue;
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 6) {
          const [text, optA, optB, optC, optD, correct, subject, difficulty] = parts;
          parsed.push({
            text,
            optA,
            optB,
            optC,
            optD,
            correct: (correct || 'A').toUpperCase(),
            subject: subject || (bulkExamId ? exams.find(e => String(e.id) === String(bulkExamId))?.subject : 'General'),
            difficulty: ['easy', 'medium', 'hard'].includes(difficulty?.toLowerCase()) ? difficulty.toLowerCase() : 'easy',
            exam_id: bulkExamId ? Number(bulkExamId) : null
          });
        }
      }

      if (parsed.length === 0) {
        alert('Could not parse any valid question lines. Make sure format is: QuestionText, OptionA, OptionB, OptionC, OptionD, Correct(A/B/C/D)');
        setBulkLoading(false);
        return;
      }

      await api.bulkAddQuestions(parsed, bulkExamId ? Number(bulkExamId) : null);
      await loadData();
      setShowBulkModal(false);
      setBulkText('');
      alert(`Successfully added ${parsed.length} questions!`);
    } catch (err) {
      alert('Bulk import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBulkLoading(false);
    }
  };

  const currentExamObj = exams.find(e => String(e.id) === String(selectedExam));

  return (
    <div>
      <div className="flex-between mb-3">
        <div>
          <div className="page-title">Question Bank</div>
          <div className="page-sub">
            {currentExamObj ? (
              <span>Configuring questions specifically for <strong>{currentExamObj.title}</strong></span>
            ) : (
              'Manage and assign specific questions for all scheduled examinations'
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowBulkModal(true)}>
            <UploadIcon size={14} /> Bulk CSV Import
          </button>
          <button className="btn btn-primary" onClick={() => {
            setForm(getEmptyForm(selectedExam));
            setShowForm(v => !v);
          }}>
            {showForm ? <><CloseIcon size={14} /> Cancel</> : <><PlusIcon size={14} /> Add Question</>}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row mb-3">
        <div className="stat-card">
          <div className="stat-label">Total Questions in Bank</div>
          <div className="stat-value">{questions.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Questions in Active Filter</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {filtered.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Selected Exam</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {selectedExam === 'all' ? 'All Exams' : selectedExam === 'unassigned' ? 'General / Unassigned' : currentExamObj?.title || selectedExam}
          </div>
        </div>
      </div>

      {/* Filter and Exam Selector Bar */}
      <div className="card mb-3" style={{ padding: '14px 18px' }}>
        <div className="flex-between gap-3" style={{ flexWrap: 'wrap' }}>
          <div className="flex gap-2" style={{ flex: 1, minWidth: 260 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search question text or subject..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Filter by Exam:
            </label>
            <select
              className="form-control"
              style={{ minWidth: 220 }}
              value={selectedExam}
              onChange={e => handleExamFilterChange(e.target.value)}
            >
              <option value="all">All Scheduled Exams ({questions.length})</option>
              <option value="unassigned">General (No Specific Exam)</option>
              {exams.map(ex => {
                const count = questions.filter(q => String(q.exam_id) === String(ex.id)).length;
                return (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({count} questions)
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* New Question Form */}
      {showForm && (
        <div className="card mb-3" style={{ border: '2px solid var(--primary-faint2)' }}>
          <div className="flex-between mb-2">
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              New Question {currentExamObj ? `for ${currentExamObj.title}` : ''}
            </div>
            <button className="btn btn-ghost p-1" onClick={() => setShowForm(false)}>
              <CloseIcon size={14} />
            </button>
          </div>
          <form onSubmit={handleAdd}>
            <div className="grid-2 mb-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Assign to Examination *</label>
                <select
                  className="form-control"
                  value={form.exam_id}
                  onChange={e => {
                    const chosenId = e.target.value;
                    const ex = exams.find(x => String(x.id) === String(chosenId));
                    setForm(f => ({
                      ...f,
                      exam_id: chosenId,
                      subject: ex ? ex.subject : f.subject
                    }));
                  }}
                  required
                >
                  <option value="">General / Shared (All Exams)</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.subject})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  This question will appear specifically inside this selected examination.
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">Subject</label>
                <input
                  className="form-control"
                  placeholder="e.g. Physics, Mathematics"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Question Text *</label>
              <textarea
                className="form-control"
                placeholder="Enter complete question text..."
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                rows={3}
                required
              />
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              {['A', 'B', 'C', 'D'].map(opt => (
                <div className="form-group" key={opt}>
                  <label className="form-label">Option {opt} *</label>
                  <input
                    className="form-control"
                    placeholder={`Answer option ${opt}...`}
                    value={form[`opt${opt}`]}
                    onChange={e => setForm(f => ({ ...f, [`opt${opt}`]: e.target.value }))}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ gap: 12, marginTop: 4 }}>
              <div className="form-group">
                <label className="form-label">Correct Option *</label>
                <select
                  className="form-control"
                  value={form.correct}
                  onChange={e => setForm(f => ({ ...f, correct: e.target.value }))}
                >
                  {['A', 'B', 'C', 'D'].map(o => (
                    <option key={o} value={o}>Option {o}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Difficulty Level</label>
                <select
                  className="form-control"
                  value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-3">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save & Add Question
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Question</th>
                <th>Target Exam</th>
                <th>Subject</th>
                <th>Difficulty</th>
                <th>Correct</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    Loading questions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    {selectedExam !== 'all' ? (
                      <div>
                        <p style={{ marginBottom: 12 }}>No questions added yet for <strong>{currentExamObj?.title || 'this exam'}</strong>.</p>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                          <PlusIcon size={13} /> Add Question for this Exam
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p style={{ marginBottom: 12 }}>No questions found in the question bank.</p>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                          <PlusIcon size={13} /> Add First Question
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((q, i) => {
                  const examObj = exams.find(e => String(e.id) === String(q.exam_id));
                  return (
                    <tr key={q.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ maxWidth: 360 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{q.text}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <span><strong>A:</strong> {q.opt_a || q.optA}</span>
                          <span><strong>B:</strong> {q.opt_b || q.optB}</span>
                          <span><strong>C:</strong> {q.opt_c || q.optC}</span>
                          <span><strong>D:</strong> {q.opt_d || q.optD}</span>
                        </div>
                      </td>
                      <td>
                        {examObj ? (
                          <span className="badge badge-purple" style={{ gap: 4 }}>
                            <ExamsIcon size={12} /> {examObj.title}
                          </span>
                        ) : (
                          <span className="badge badge-gray">General (All)</span>
                        )}
                      </td>
                      <td>{q.subject}</td>
                      <td>
                        <span className={`badge ${q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ fontWeight: 700 }}>
                          {q.correct}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-icon btn-sm" onClick={() => handleDelete(q.id)} title="Delete Question">
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Bulk CSV Import */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="flex-between mb-2">
              <div style={{ fontWeight: 600, fontSize: 16 }}>Bulk Import Questions (CSV)</div>
              <button className="btn btn-ghost p-1" onClick={() => setShowBulkModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Paste questions in format: <code>Question, OptionA, OptionB, OptionC, OptionD, Correct(A/B/C/D), Subject, Difficulty</code>
            </p>

            <form onSubmit={handleBulkImport}>
              <div className="form-group">
                <label className="form-label">Assign All Imported Questions to Exam *</label>
                <select
                  className="form-control"
                  value={bulkExamId}
                  onChange={e => setBulkExamId(e.target.value)}
                  required
                >
                  <option value="">General (No Specific Exam)</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title} ({ex.subject})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Questions Data (1 per line)</label>
                <textarea
                  className="form-control"
                  rows={7}
                  placeholder={`What is the speed of light?, 3x10^8 m/s, 2x10^8 m/s, 1x10^8 m/s, 4x10^8 m/s, A, Physics, easy\nWhat is the derivative of x^2?, x, 2x, 2, x^2, B, Mathematics, easy`}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12.5 }}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-ghost" onClick={() => setShowBulkModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={bulkLoading}>
                  {bulkLoading ? 'Importing...' : 'Import Questions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
