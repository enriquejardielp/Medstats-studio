import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authService } from '../services/authService';
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem('access_token'));
  useEffect(() => {
    if (token) {
      setLoading(true);
      authService.getProfile()
        .then(setUser)
        .catch(() => {
          setToken(null);
          localStorage.removeItem('access_token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);
  const login = async (email: string, password: string) => {
    const data = await authService.login({ email, password });
    localStorage.setItem('access_token', data.access_token);
    setToken(data.access_token);
    const user = await authService.getProfile();
    setUser(user);
  };
  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };
  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
