import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { PlusIcon, CloseIcon, TrashIcon, UploadIcon, ExamsIcon } from '../components/Icons';
import QuestionDisplay from '../components/QuestionDisplay';

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

  // Default empty form with dynamic options and multiple correct choices
  const getEmptyForm = (examId) => {
    const targetExam = exams.find(e => String(e.id) === String(examId));
    return {
      text: '',
      options: ['', '', '', ''], // 4 initial options (can be 2, 3, 5, 6 etc.)
      correct: ['A'], // Array of correct option letters
      subject: targetExam ? targetExam.subject : '',
      exam_id: examId && examId !== 'all' && examId !== 'unassigned' ? String(examId) : ''
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
      console.error('Failed to load QuestionBank data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const pId = searchParams.get('examId');
    if (pId) {
      setSelectedExam(pId);
      setBulkExamId(pId);
      setForm(prev => ({ ...prev, exam_id: pId }));
    }
  }, [searchParams]);

  const handleExamFilterChange = (newExamId) => {
    setSelectedExam(newExamId);
    if (newExamId === 'all') {
      searchParams.delete('examId');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ examId: newExamId });
    }
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

  // Option management in new question form
  const handleOptionChange = (index, value) => {
    setForm(prev => {
      const nextOpts = [...prev.options];
      nextOpts[index] = value;
      return { ...prev, options: nextOpts };
    });
  };

  const addOption = () => {
    setForm(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index) => {
    if (form.options.length <= 2) {
      alert('A question must have at least 2 options.');
      return;
    }
    const removedLetter = String.fromCharCode(65 + index);
    setForm(prev => {
      const nextOpts = prev.options.filter((_, i) => i !== index);
      // Re-map correct answers because letters shift
      const nextCorrect = prev.correct
        .filter(l => l !== removedLetter)
        .map(l => {
          const code = l.charCodeAt(0);
          if (code > 65 + index) return String.fromCharCode(code - 1);
          return l;
        });
      return {
        ...prev,
        options: nextOpts,
        correct: nextCorrect.length > 0 ? nextCorrect : ['A']
      };
    });
  };

  // Toggle correct choice (supports multiple correct answers)
  const toggleCorrectOption = (letter) => {
    setForm(prev => {
      const exists = prev.correct.includes(letter);
      let updated;
      if (exists) {
        if (prev.correct.length <= 1) {
          alert('At least one correct answer must be selected.');
          return prev;
        }
        updated = prev.correct.filter(l => l !== letter);
      } else {
        updated = [...prev.correct, letter].sort();
      }
      return { ...prev, correct: updated };
    });
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
    const cleanOpts = form.options.map(o => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      alert('Please fill out at least 2 options for this question.');
      return;
    }
    if (form.correct.length === 0) {
      alert('Please check at least one correct answer.');
      return;
    }

    try {
      const payload = {
        text: form.text.trim(),
        options: cleanOpts,
        correct: form.correct.join(','),
        subject: form.subject.trim() || 'General',
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

  // Bulk CSV parser supporting dynamic options and multiple correct answers
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setBulkLoading(true);

    try {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = [];

      for (const line of lines) {
        // Skip header lines
        if (/^(question|text|q\.?no)/i.test(line)) continue;

        // Split by pipe first, then semicolon, then comma
        let separator = ',';
        if (line.includes('|')) separator = '|';
        else if (line.includes(';')) separator = ';';

        const parts = line.split(separator).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 3) {
          // Strict: correct answer field is ONLY letters A-D optionally separated by commas
          // e.g. "A", "B", "C", "D", "A,C", "A,B,D" — nothing else
          const lastPart = parts[parts.length - 1];
          const isCorrectField = /^[A-D]([,;][A-D])*$/i.test(lastPart.trim());

          let correctVal = 'A';
          let optionsList = [];
          const text = parts[0];

          if (isCorrectField) {
            correctVal = lastPart.trim().replace(/;/g, ',').toUpperCase();
            optionsList = parts.slice(1, parts.length - 1);
          } else {
            optionsList = parts.slice(1);
          }

          if (optionsList.length >= 2) {
            parsed.push({
              text,
              options: optionsList,
              correct: correctVal,
              subject: bulkExamId ? exams.find(e => String(e.id) === String(bulkExamId))?.subject || 'General' : 'General',
              exam_id: bulkExamId ? Number(bulkExamId) : null
            });
          }
        }
      }

      if (parsed.length === 0) {
        alert('Could not parse valid question lines. Example format:\nWhat is 2+2? | 3 | 4 | 5 | B\nWhich are fruits? | Apple | Carrot | Mango | A,C');
        setBulkLoading(false);
        return;
      }

      await api.bulkAddQuestions(parsed, bulkExamId ? Number(bulkExamId) : null);
      await loadData();
      setShowBulkModal(false);
      setBulkText('');
      alert(`Successfully imported ${parsed.length} questions!`);
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
              <span>Managing questions for <strong>{currentExamObj.title}</strong></span>
            ) : (
              'Questions, dynamic options, and correct answers per examination'
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

      {/* Stats bar */}
      <div className="stats-row mb-3">
        <div className="stat-card">
          <div className="stat-label">Total Questions</div>
          <div className="stat-value">{questions.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Current Filter</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {filtered.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Selected Exam</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {selectedExam === 'all' ? 'All Exams' : selectedExam === 'unassigned' ? 'General' : currentExamObj?.title || selectedExam}
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
              placeholder="Search questions by text or subject..."
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
            {/* Exam and Subject */}
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
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">Subject</label>
                <input
                  className="form-control"
                  placeholder="e.g. Physics, General"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                />
              </div>
            </div>

            {/* Question Text */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Question Text *</label>
              <textarea
                className="form-control"
                placeholder="Type your question text here..."
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                rows={3}
                required
              />
            </div>

            {/* Dynamic Options List */}
            <div style={{ marginBottom: 16 }}>
              <div className="flex-between mb-2">
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                  Options & Correct Answer(s) *
                </label>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Check the green box for each correct answer (single or multiple)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.options.map((optText, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isCorrect = form.correct.includes(letter);

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: isCorrect ? 'var(--primary-faint)' : 'var(--bg-input)',
                        border: `1px solid ${isCorrect ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Checkbox button for correct answer */}
                      <button
                        type="button"
                        onClick={() => toggleCorrectOption(letter)}
                        title={isCorrect ? 'Marked as Correct Answer' : 'Click to mark as Correct Answer'}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          border: `2px solid ${isCorrect ? 'var(--primary)' : 'var(--border)'}`,
                          background: isCorrect ? 'var(--primary)' : 'transparent',
                          color: isCorrect ? '#fff' : 'var(--text-sub)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isCorrect ? '✓' : letter}
                      </button>

                      {/* Option Text Input */}
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Option ${letter} text...`}
                        value={optText}
                        onChange={e => handleOptionChange(idx, e.target.value)}
                        required
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: '4px 6px',
                          fontSize: 13.5
                        }}
                      />

                      {/* Correct Status Tag */}
                      {isCorrect && (
                        <span className="badge badge-green" style={{ fontSize: 11, flexShrink: 0 }}>
                          Correct
                        </span>
                      )}

                      {/* Remove Option Button (minimum 2 options) */}
                      {form.options.length > 2 && (
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          onClick={() => removeOption(idx)}
                          title="Remove option"
                          style={{ padding: '4px 6px' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Option Button */}
              <div className="mt-2" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={addOption}
                  style={{ gap: 6 }}
                >
                  <PlusIcon size={13} /> Add Another Option ({String.fromCharCode(65 + form.options.length)})
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Selected correct: <strong>{form.correct.join(', ')}</strong> ({form.correct.length > 1 ? 'Multiple Choice' : 'Single Choice'})
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-3">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Question
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
                <th>Options</th>
                <th>Target Exam</th>
                <th>Subject</th>
                <th>Correct Answer</th>
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
                  
                  // Extract options list
                  let opts = q.options;
                  if (typeof opts === 'string') {
                    try { opts = JSON.parse(opts); } catch { opts = []; }
                  }
                  if (!Array.isArray(opts) || opts.length === 0) {
                    opts = [q.opt_a || q.optA, q.opt_b || q.optB, q.opt_c || q.optC, q.opt_d || q.optD].filter(Boolean);
                  }

                  const isMulti = String(q.correct).includes(',') || (Array.isArray(q.correct) && q.correct.length > 1);

                  return (
                    <tr key={q.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ maxWidth: 440 }}>
                        <QuestionDisplay text={q.text} />
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: '6px 12px', flexWrap: 'wrap' }}>
                          {opts.map((optText, idx) => (
                            <span key={idx}>
                              <strong>{String.fromCharCode(65 + idx)}:</strong> {optText}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>
                          {opts.length} Options
                        </span>
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
                      <td>{q.subject || 'General'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="badge badge-blue" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                            {Array.isArray(q.correct) ? q.correct.join(', ') : q.correct}
                          </span>
                          {isMulti && (
                            <span className="badge badge-yellow" style={{ fontSize: 10 }}>
                              Multi
                            </span>
                          )}
                        </div>
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
              <div style={{ fontWeight: 600, fontSize: 16 }}>Bulk Import Questions (CSV / Pipe)</div>
              <button className="btn btn-ghost p-1" onClick={() => setShowBulkModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Enter questions with any number of options and correct answer at the end (e.g. <code>A</code> or <code>A,C</code>).
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
                <label className="form-label">Questions Data (1 per line, separated by | or ,)</label>
                <textarea
                  className="form-control"
                  rows={8}
                  placeholder={`What is 2+2? | 3 | 4 | 5 | B\nIs the earth flat? | True | False | B\nSelect primary colors | Red | Green | Blue | Yellow | A,C\nWhich are programming languages? | Python | HTML | Rust | SQL | A,C`}
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
