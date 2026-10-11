import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PlusIcon, TrashIcon, UploadIcon, CloseIcon } from '../components/Icons';

export default function CandidateManager() {
  const [candidates, setCandidates] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Single Add form
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newExamId, setNewExamId] = useState('');

  // Bulk Import
  const [bulkText, setBulkText] = useState('');
  const [bulkExamId, setBulkExamId] = useState('');

  // Fetch candidates & exams
  const loadData = async () => {
    setLoading(true);
    try {
      const [candRes, examRes] = await Promise.all([
        api.getCandidates(selectedExam !== 'all' ? selectedExam : null).catch(() => []),
        api.getExams().catch(() => [])
      ]);
      setCandidates(candRes || []);
      setExams(examRes || []);
    } catch {
      // Fallback
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedExam]);

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!newRoll.trim() || !newName.trim()) return;

    try {
      await api.addCandidate({
        roll_no: newRoll.trim(),
        name: newName.trim(),
        exam_id: newExamId ? Number(newExamId) : null,
      });
      setShowAddModal(false);
      setNewRoll('');
      setNewName('');
      setNewExamId('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to add candidate');
    }
  };

  const handleBulkSubmit = async () => {
    if (!bulkText.trim()) return;

    // Parse pasted lines: format can be "ROLL, NAME" or "ROLL \t NAME"
    const lines = bulkText.split('\n');
    const parsed = [];

    lines.forEach(line => {
      const clean = line.trim();
      if (!clean) return;
      // split by comma or tab or hyphen
      let parts = [];
      if (clean.includes(',')) parts = clean.split(',');
      else if (clean.includes('\t')) parts = clean.split('\t');
      else if (clean.includes('-')) parts = clean.split('-');
      else parts = clean.split(/\s{2,}/); // 2 or more spaces

      if (parts.length >= 2) {
        parsed.push({
          roll_no: parts[0].trim(),
          name: parts.slice(1).join(' ').trim(),
        });
      }
    });

    if (parsed.length === 0) {
      alert('Could not find valid candidate rows. Please use format: RollNumber, StudentName');
      return;
    }

    try {
      await api.bulkAddCandidates(parsed, bulkExamId ? Number(bulkExamId) : null);
      setShowBulkModal(false);
      setBulkText('');
      setBulkExamId('');
      loadData();
      alert(`Successfully added ${parsed.length} candidate(s)!`);
    } catch (err) {
      alert(err.message || 'Failed to bulk import candidates');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBulkText(event.target.result || '');
    };
    reader.readAsText(file);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this candidate?')) return;
    try {
      await api.deleteCandidate(id);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete candidate');
    }
  };

  // Filter candidates by search term
  const filtered = candidates.filter(c => {
    const term = search.toLowerCase();
    const matchRoll = c.roll_no?.toLowerCase().includes(term);
    const matchName = c.name?.toLowerCase().includes(term);
    return matchRoll || matchName;
  });

  return (
    <div>
      <div className="flex-between mb-3">
        <div>
          <div className="page-title">Candidate Management</div>
          <div className="page-sub">Only enrolled candidates listed here can access examination rooms</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowBulkModal(true)}>
            <UploadIcon size={14} /> Bulk Import (CSV)
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <PlusIcon size={14} /> Add Candidate
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="stats-row mb-3">
        <div className="stat-card">
          <div className="stat-label">Total Approved Candidates</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{candidates.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Exam Filter</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {selectedExam === 'all' ? 'All Exams' : exams.find(e => String(e.id) === String(selectedExam))?.title || selectedExam}
          </div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="card mb-3" style={{ padding: '14px 18px' }}>
        <div className="flex-between gap-3" style={{ flexWrap: 'wrap' }}>
          <div className="flex gap-2" style={{ flex: 1, minWidth: 260 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by Roll Number or Name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Filter by Exam:</label>
            <select
              className="form-control"
              style={{ width: 200 }}
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
            >
              <option value="all">All Exams</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.title} ({ex.subject})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Candidate List Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Student Full Name</th>
                <th>Permitted Exam</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    Loading candidate list...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No candidates found. Click "Add Candidate" or "Bulk Import" to approve students.
                  </td>
                </tr>
              ) : (
                filtered.map(cand => {
                  const examObj = exams.find(e => String(e.id) === String(cand.exam_id));
                  return (
                    <tr key={cand.id}>
                      <td>
                        <span className="badge badge-purple" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                          {cand.roll_no}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{cand.name}</td>
                      <td>
                        {examObj ? (
                          <span className="badge badge-blue">{examObj.title}</span>
                        ) : (
                          <span className="badge badge-gray">All Scheduled Exams</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', color: 'var(--danger)' }}
                          title="Remove Candidate"
                          onClick={() => handleDelete(cand.id)}
                        >
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

      {/* Modal: Add Single Candidate */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <div className="flex-between mb-3">
              <div style={{ fontWeight: 600, fontSize: 16 }}>Add Approved Candidate</div>
              <button className="btn btn-ghost p-1" onClick={() => setShowAddModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <form onSubmit={handleAddSingle}>
              <div className="form-group">
                <label className="form-label">Roll Number *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 2026-CS-106"
                  value={newRoll}
                  onChange={e => setNewRoll(e.target.value)}
                  autoFocus
                  required
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Student Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rohan Gupta"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Assign to Exam (Optional)</label>
                <select
                  className="form-control"
                  value={newExamId}
                  onChange={e => setNewExamId(e.target.value)}
                >
                  <option value="">Eligible for All Exams</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title} ({ex.subject})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Approve Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Import Candidates */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="flex-between mb-2">
              <div style={{ fontWeight: 600, fontSize: 16 }}>Bulk Import Approved Candidates</div>
              <button className="btn btn-ghost p-1" onClick={() => setShowBulkModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Upload a CSV file or paste lines in format: <code>RollNumber, StudentName</code>
            </p>

            <div className="form-group">
              <label className="form-label">Upload CSV / TXT File</label>
              <input
                type="file"
                accept=".csv,.txt"
                className="form-control"
                onChange={handleFileUpload}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Or Paste Roster Text (One per line)</label>
              <textarea
                className="form-control"
                rows={6}
                placeholder={`2026-CS-101, Rahul Sharma\n2026-CS-102, Priya Patel\n2026-CS-103, Amit Kumar`}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assign Exam (Optional)</label>
              <select
                className="form-control"
                value={bulkExamId}
                onChange={e => setBulkExamId(e.target.value)}
              >
                <option value="">Eligible for All Exams</option>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.title} ({ex.subject})</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setShowBulkModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleBulkSubmit}>
                Import All Candidates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
