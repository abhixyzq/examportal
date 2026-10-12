import { createContext, useContext, useState } from 'react';
import { invalidateApiCache } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ep_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('ep_user');
      return null;
    }
  });

  const login = (userData, token) => {
    invalidateApiCache();
    sessionStorage.clear();
    localStorage.setItem('ep_user', JSON.stringify(userData));
    localStorage.setItem('ep_token', token);
    setUser(userData);
  };

  const logout = () => {
    invalidateApiCache();
    sessionStorage.clear();
    localStorage.removeItem('ep_user');
    localStorage.removeItem('ep_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
