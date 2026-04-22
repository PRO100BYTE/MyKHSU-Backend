import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setLoading(false); return; }
    api.checkToken().then(res => {
      if (res?.ok) setUser(res.data.user);
      else localStorage.removeItem('admin_token');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    if (res?.ok) {
      localStorage.setItem('admin_token', res.data.token);
      const check = await api.checkToken();
      if (check?.ok) {
        setUser(check.data.user);
      } else {
        setUser({ username });
      }
      return { ok: true };
    }
    return { ok: false, error: res?.data?.error ?? 'Ошибка авторизации' };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
