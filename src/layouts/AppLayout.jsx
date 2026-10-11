import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { 
  DashboardIcon, 
  QuestionsIcon, 
  ExamsIcon, 
  MonitorIcon, 
  ResultsIcon, 
  LogoutIcon,
  UsersIcon,
  MenuIcon,
  CloseIcon
} from '../components/Icons';

const adminNav = [
  { to: '/admin', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/admin/candidates', label: 'Candidates', Icon: UsersIcon },
  { to: '/admin/exams', label: 'Exams', Icon: ExamsIcon },
  { to: '/admin/questions', label: 'Questions', Icon: QuestionsIcon },
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
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const nav = user?.role === 'admin' ? adminNav : studentNav;

  // Auto-close mobile drawer when switching pages
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
        </button>
        <div className="mobile-logo">
          Exam<span>Portal</span>
        </div>
        <div className="mobile-actions">
          <ThemeToggle showLabel={false} />
        </div>
      </header>

      {/* Backdrop for Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header-row">
          <div className="sidebar-logo">
            Exam<span>Portal</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon size={16} />
          </button>
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
                onClick={() => setMobileMenuOpen(false)}
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

