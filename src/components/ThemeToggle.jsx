import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon } from './Icons';

export default function ThemeToggle({ className = '', showLabel = true }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      aria-label="Toggle theme"
    >
      <span className="theme-toggle-icon">
        {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
      </span>
      {showLabel && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  );
}
