// Production Store defaults (Zero dummy data)
export const DEMO_EXAMS = [];

export const getStoredExams = () => {
  try {
    const raw = localStorage.getItem('ep_exams');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

export const saveStoredExams = (exams) => {
  localStorage.setItem('ep_exams', JSON.stringify(exams));
};

export const DEMO_QUESTIONS = [];

export const DEMO_STUDENTS = [];

export const DEMO_RESULTS = [];
