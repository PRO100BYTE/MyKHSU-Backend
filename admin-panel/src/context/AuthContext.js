import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setLoading(false); return; }
    api.checkToken().then(res => {
      if (res?.ok) {
        setUser(res.data.user);
        setPermissions(res.data.permissions || []);
      } else localStorage.removeItem('admin_token');
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
        setPermissions(check.data.permissions || []);
      } else {
        setUser({ username });
        setPermissions([]);
      }
      return { ok: true };
    }
    return { ok: false, error: res?.data?.error ?? 'Ошибка авторизации' };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    setUser(null);
    setPermissions([]);
  }, []);

  const hasPermission = useCallback((perm) => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin имеет все права
    return permissions.includes(perm);
  }, [user, permissions]);

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
