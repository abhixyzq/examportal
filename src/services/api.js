// Frontend API Client connected to Vercel Serverless / Node.js Backend

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('ep_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `HTTP error! status: ${res.status}`);
    }

    return data;
  } catch (err) {
    console.warn(`API [${endpoint}] fallback:`, err.message);
    throw err;
  }
}

export const api = {
  // Auth
  login: async (email, password, role) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
  },
  getMe: async () => request('/auth/me'),

  // Questions
  getQuestions: async () => request('/questions'),
  addQuestion: async (question) => request('/questions', {
    method: 'POST',
    body: JSON.stringify(question),
  }),
  bulkAddQuestions: async (questions) => request('/questions/bulk', {
    method: 'POST',
    body: JSON.stringify({ questions }),
  }),
  deleteQuestion: async (id) => request(`/questions/${id}`, {
    method: 'DELETE',
  }),

  // Exams
  getExams: async () => request('/exams'),
  createExam: async (examData) => request('/exams', {
    method: 'POST',
    body: JSON.stringify(examData),
  }),
  verifyExamCode: async (id, code) => request(`/exams/${id}/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  }),
  toggleLiveResult: async (id) => request(`/exams/${id}/toggle-result`, {
    method: 'PATCH',
  }),
  toggleRequireCode: async (id) => request(`/exams/${id}/toggle-code`, {
    method: 'PATCH',
  }),
  deleteExam: async (id) => request(`/exams/${id}`, {
    method: 'DELETE',
  }),

  // Submissions & Results
  submitExam: async (submissionData) => request('/submissions', {
    method: 'POST',
    body: JSON.stringify(submissionData),
  }),
  getExamResults: async (examId) => request(`/submissions/results/${examId}`),
  getMyResults: async () => request('/submissions/my-results'),

  // Serverless Real-time Proctoring & Monitor
  sendHeartbeat: async (data) => request('/monitor/heartbeat', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  reportViolation: async (data) => request('/monitor/violation', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getLiveMonitor: async (examId) => request(`/monitor/live?examId=${examId}`),
  disqualifyStudent: async (examId, studentId) => request('/monitor/disqualify', {
    method: 'POST',
    body: JSON.stringify({ examId, studentId }),
  }),
  getStudentStatus: async (examId) => request(`/monitor/status?examId=${examId}`),
};
