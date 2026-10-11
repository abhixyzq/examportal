// Demo data - will be replaced by API calls
export const DEMO_EXAMS = [
  { id: 1, title: 'Mathematics Test', subject: 'Math', duration: 60, total: 30, date: '2026-10-15', time: '10:00', status: 'upcoming', proctored: true, liveResult: false, shuffleQ: true, shuffleOpt: true, requireCode: true, accessCode: 'MATH26' },
  { id: 2, title: 'Physics Mid-Term', subject: 'Physics', duration: 90, total: 50, date: '2026-10-11', time: '11:00', status: 'active', proctored: true, liveResult: true, shuffleQ: true, shuffleOpt: false, requireCode: true, accessCode: 'PHYS90' },
  { id: 3, title: 'Chemistry Quiz', subject: 'Chemistry', duration: 30, total: 20, date: '2026-10-05', time: '09:00', status: 'completed', proctored: false, liveResult: true, shuffleQ: false, shuffleOpt: false, requireCode: false, accessCode: '' },
];

export const getStoredExams = () => {
  try {
    const raw = localStorage.getItem('ep_exams');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEMO_EXAMS;
};

export const saveStoredExams = (exams) => {
  localStorage.setItem('ep_exams', JSON.stringify(exams));
};

export const DEMO_QUESTIONS = [
  { id: 1, text: 'What is the value of π (pi) to 2 decimal places?', optA: '3.14', optB: '3.41', optC: '3.12', optD: '3.16', correct: 'A', subject: 'Math', difficulty: 'easy' },
  { id: 2, text: 'Which of the following is Newton\'s Second Law of Motion?', optA: 'F = ma', optB: 'E = mc²', optC: 'v = u + at', optD: 'P = mv', correct: 'A', subject: 'Physics', difficulty: 'easy' },
  { id: 3, text: 'What is the atomic number of Carbon?', optA: '6', optB: '12', optC: '8', optD: '4', correct: 'A', subject: 'Chemistry', difficulty: 'easy' },
  { id: 4, text: 'Solve: If 2x + 5 = 17, what is x?', optA: '5', optB: '6', optC: '4', optD: '7', correct: 'B', subject: 'Math', difficulty: 'medium' },
  { id: 5, text: 'What is the SI unit of Electric Current?', optA: 'Volt', optB: 'Watt', optC: 'Ampere', optD: 'Ohm', correct: 'C', subject: 'Physics', difficulty: 'easy' },
];

export const DEMO_STUDENTS = [
  { id: 1, name: 'Rahul Sharma', email: 'rahul@s.com', answered: 12, total: 30, violations: 0, timeLeft: '42:10', status: 'active' },
  { id: 2, name: 'Priya Singh', email: 'priya@s.com', answered: 18, total: 30, violations: 1, timeLeft: '38:22', status: 'warning' },
  { id: 3, name: 'Amit Kumar', email: 'amit@s.com', answered: 5, total: 30, violations: 3, timeLeft: '51:00', status: 'danger' },
  { id: 4, name: 'Neha Gupta', email: 'neha@s.com', answered: 25, total: 30, violations: 0, timeLeft: '20:15', status: 'active' },
  { id: 5, name: 'Rohit Verma', email: 'rohit@s.com', answered: 30, total: 30, violations: 0, timeLeft: '05:00', status: 'active' },
  { id: 6, name: 'Sneha Patel', email: 'sneha@s.com', answered: 9, total: 30, violations: 2, timeLeft: '44:00', status: 'warning' },
];
