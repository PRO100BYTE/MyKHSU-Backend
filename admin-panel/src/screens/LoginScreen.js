import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BrandMark from '../components/BrandMark';
import { ADMIN_UI } from '../constants';

export default function LoginScreen() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) {
      showToast({
        variant: 'warning',
        title: 'Введите логин и пароль.',
        code: 'UI-AUTH-003',
      });
      return;
    }
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);

    if (res.ok) {
      showToast({ variant: 'success', title: res.message || 'Авторизация прошла успешно.' });
      return;
    }

    showToast({
      variant: 'error',
      title: res.message || 'Произошла неопознанная ошибка. Повторите попытку, либо обратитесь к администратору.',
      description: res.description || '',
      code: res.code || 'UI-AUTH-002',
      duration: 8000,
    });
  }

  return (
    <div className="login-screen">
      <div className="login-card login-card--animated">
        <div className="login-logo">
          <div className="login-logo__icon-wrap">
            <BrandMark className="login-logo__icon" />
          </div>
          <div className="login-logo__title">{ADMIN_UI.brandTitle}</div>
          <div className="login-logo__sub">{ADMIN_UI.loginSubTitle}</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group form-group--login">
            <label className="form-label form-label--row">
              <ion-icon name="person-outline" aria-hidden="true" />
              <span>Логин</span>
            </label>
            <div className="input-with-icon">
              <input
                className="form-input input-with-icon__control input-with-icon__control--clean"
                type="text"
                autoComplete="username"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group form-group--password">
            <label className="form-label form-label--row">
              <ion-icon name="lock-closed-outline" aria-hidden="true" />
              <span>Пароль</span>
            </label>
            <div className="input-with-icon">
              <input
                className="form-input input-with-icon__control input-with-icon__control--clean input-with-icon__control--password"
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
                onClick={() => setShowPassword(v => !v)}
                disabled={loading}
              >
                <ion-icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
            {loading ? 'Вход...' : 'Войти'}
          </button>

          <div className={`forgot-password${forgotOpen ? ' forgot-password--open' : ''}`}>
            <button
              type="button"
              className="forgot-password__button"
              onClick={() => setForgotOpen(v => !v)}
              onBlur={() => setForgotOpen(false)}
            >
              Забыли пароль?
            </button>
            <div className="forgot-password__hint" role="note">
              В данной версии панели управления отсутствует возможность восстановления пароля посредством электронной почты. Для восстановления доступа обратитесь к администратору.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
