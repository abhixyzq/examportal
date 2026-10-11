import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { 
  DashboardIcon, 
  QuestionsIcon, 
  ExamsIcon, 
  MonitorIcon, 
  ResultsIcon, 
  LogoutIcon 
} from '../components/Icons';

const adminNav = [
  { to: '/admin', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/admin/questions', label: 'Questions', Icon: QuestionsIcon },
  { to: '/admin/exams', label: 'Exams', Icon: ExamsIcon },
  { to: '/admin/monitor', label: 'Live Monitor', Icon: MonitorIcon },
  { to: '/admin/results', label: 'Results', Icon: ResultsIcon },
];

const studentNav = [
  { to: '/student', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/student/results', label: 'My Results', Icon: ResultsIcon },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = user?.role === 'admin' ? adminNav : studentNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          Exam<span>Portal</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(item => {
            const Icon = item.Icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin' || item.to === '/student'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon-wrap"><Icon size={16} /></span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div style={{ padding: '0 4px 10px' }}>
            <ThemeToggle className="w-full" showLabel={true} />
          </div>
          <div style={{ padding: '0 10px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ color: 'var(--text-sub)', fontWeight: 500 }}>{user?.name}</div>
            <div style={{ fontSize: 11, textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
          <button className="nav-item btn-danger" onClick={handleLogout} style={{ width: '100%' }}>
            <span className="nav-icon-wrap"><LogoutIcon size={15} /></span> Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
