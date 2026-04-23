import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

function getAuthFailure(res) {
  if (res?.status === 0 || res?.errorCode === 'UI-NET-001') {
    return {
      message: 'Нет связи с сервером. Повторите попытку позже, либо обратитесь к администратору.',
      code: 'UI-NET-001',
      description: '',
    };
  }

  if (res?.errorCode === 'ADM-AUTH-002') {
    return {
      message: 'Неверный логин или пароль. Если вы считаете, что введенные данные верны - обратитесь к администратору.',
      code: res.errorCode,
      description: '',
    };
  }

  if (res?.errorCode === 'ADM-AUTH-003') {
    return {
      message: 'Данная учетная запись отключена. Обратитесь к администратору.',
      code: res.errorCode,
      description: '',
    };
  }

  return {
    message: 'Произошла неопознанная ошибка. Повторите попытку, либо обратитесь к администратору.',
    code: res?.errorCode || 'UI-AUTH-002',
    description: res?.error || '',
  };
}

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('admin_token');
    setUser(null);
    setPermissions([]);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setLoading(false); return; }
    api.checkToken().then(res => {
      if (res?.ok && res?.data?.user && Array.isArray(res?.data?.permissions)) {
        setUser(res.data.user);
        setPermissions(res.data.permissions || []);
      } else {
        clearSession();
      }
      setLoading(false);
    }).catch(() => {
      clearSession();
      setLoading(false);
    });
  }, [clearSession]);

  useEffect(() => {
    const handleAuthExpired = () => {
      clearSession();
      showToast({
        variant: 'warning',
        title: 'Сеанс авторизации истек. Выполните вход повторно.',
        code: 'ADM-AUTH-008',
      });
    };

    window.addEventListener('admin-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('admin-auth-expired', handleAuthExpired);
  }, [clearSession, showToast]);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    if (!res?.ok) {
      return { ok: false, ...getAuthFailure(res) };
    }

    localStorage.setItem('admin_token', res.data.token);
    const check = await api.checkToken();

    if (check?.ok && check?.data?.user && Array.isArray(check?.data?.permissions)) {
      setUser(check.data.user);
      setPermissions(check.data.permissions || []);
      return { ok: true, message: 'Авторизация прошла успешно.' };
    }

    clearSession();
    return {
      ok: false,
      message: 'Невозможно загрузить роли пользователя. Обратитесь к администратору.',
      code: check?.errorCode || 'UI-AUTH-001',
      description: check?.error || '',
    };
  }, [clearSession]);

  const logout = useCallback(() => {
    clearSession();
    showToast({ variant: 'info', title: 'Сеанс завершён.' });
  }, [clearSession, showToast]);

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
