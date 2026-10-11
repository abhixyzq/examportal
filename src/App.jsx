import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Login } from './pages/Login';
import AppLayout from './layouts/AppLayout';
import AdminDashboard from './admin/AdminDashboard';
import QuestionBank from './admin/QuestionBank';
import ExamManager from './admin/ExamManager';
import CandidateManager from './admin/CandidateManager';
import LiveMonitor from './admin/LiveMonitor';
import AdminResults from './admin/AdminResults';
import StudentDashboard from './student/StudentDashboard';
import ExamRoom from './student/ExamRoom';
import ResultPage from './student/ResultPage';
import MyResults from './student/MyResults';

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin"><AppLayout /></ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="candidates" element={<CandidateManager />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="exams" element={<ExamManager />} />
            <Route path="monitor" element={<LiveMonitor />} />
            <Route path="results" element={<AdminResults />} />
          </Route>

          {/* Student routes */}
          <Route path="/student" element={
            <ProtectedRoute role="student"><AppLayout /></ProtectedRoute>
          }>
            <Route index element={<StudentDashboard />} />
            <Route path="results" element={<MyResults />} />
            <Route path="result" element={<ResultPage />} />
          </Route>

          {/* Exam room - full screen, no sidebar */}
          <Route path="/student/exam/:id" element={
            <ProtectedRoute role="student"><ExamRoom /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  );
}
