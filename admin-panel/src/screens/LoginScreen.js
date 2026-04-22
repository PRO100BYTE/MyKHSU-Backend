import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { ADMIN_UI } from '../constants';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) { setError('Введите логин и пароль'); return; }
    setLoading(true);
    setError('');
    const res = await login(username, password);
    setLoading(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo__badge" aria-hidden="true">
            <ion-icon name="shield-checkmark-outline" />
          </div>
          <BrandMark className="login-logo__icon" />
          <div className="login-logo__title">{ADMIN_UI.brandTitle}</div>
          <div className="login-logo__sub">{ADMIN_UI.loginSubTitle}</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Логин</label>
            <div className="input-with-icon">
              <ion-icon className="input-icon" name="person-outline" aria-hidden="true" />
              <input
                className="form-input input-with-icon__control"
                type="text"
                autoComplete="username"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Пароль</label>
            <div className="input-with-icon">
              <ion-icon className="input-icon" name="lock-closed-outline" aria-hidden="true" />
              <input
                className="form-input input-with-icon__control input-with-icon__control--password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="input-toggle"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                onClick={() => setShowPassword(v => !v)}
                disabled={loading}
              >
                <ion-icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
