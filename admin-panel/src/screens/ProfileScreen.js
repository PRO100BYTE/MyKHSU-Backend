import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const ROLE_LABELS = {
  admin: 'Администратор',
  schedule_dispatcher: 'Диспетчер расписания',
  news_editor: 'Редактор новостей',
  manager: 'Менеджер',
  unified_window_agent: 'Агент единого окна',
};

export default function ProfileScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    position: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const resp = await api.getProfile();
      if (!mounted || !resp?.ok) return;
      const data = resp.data || {};
      setForm(prev => ({
        ...prev,
        username: data.username || '',
        first_name: data.first_name || '',
        middle_name: data.middle_name || '',
        last_name: data.last_name || '',
        position: data.position || '',
        email: data.email || '',
      }));
      setLoadingProfile(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    setError('');
    if (form.new_password && form.new_password !== form.confirm_password) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }
    setSaving(true);
    const payload = {
      username: form.username,
      first_name: form.first_name,
      middle_name: form.middle_name,
      last_name: form.last_name,
      position: form.position,
      email: form.email,
    };
    if (form.new_password) {
      payload.current_password = form.current_password;
      payload.new_password = form.new_password;
    }

    const resp = await api.updateProfile(payload);
    setSaving(false);
    if (!resp?.ok) {
      setError(resp?.data?.error || 'Не удалось обновить профиль');
      return;
    }

    setForm(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const initials = (() => {
    if (form.first_name && form.last_name) return (form.first_name[0] + form.last_name[0]).toUpperCase();
    if (form.first_name) return form.first_name[0].toUpperCase();
    return (user?.username?.[0] ?? 'U').toUpperCase();
  })();

  const displayName = [form.last_name, form.first_name, form.middle_name].filter(Boolean).join(' ') || user?.username || '';

  if (loadingProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Hero-блок */}
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">{initials}</div>
        </div>
        <div className="profile-hero-info">
          <div className="profile-hero-name">{displayName}</div>
          <div className="profile-hero-role">{ROLE_LABELS[user?.role] ?? user?.role ?? '—'}</div>
          {form.position && <div className="profile-hero-pos">{form.position}</div>}
        </div>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => navigate(-1)}>
          <ion-icon name="arrow-back-outline" />
          Назад
        </button>
      </div>

      <div className="profile-sections">
        {/* Раздел: Личные данные */}
        <div className="card profile-card">
          <div className="card__header">
            <ion-icon name="person-outline" />
            Личные данные
          </div>
          <div className="card__body">
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Имя</span>
                <input className="input" value={form.first_name}
                  onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                  placeholder="Введите имя" />
              </label>
              <label className="field">
                <span className="field__label">Фамилия</span>
                <input className="input" value={form.last_name}
                  onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                  placeholder="Введите фамилию" />
              </label>
              <label className="field">
                <span className="field__label">Отчество</span>
                <input className="input" value={form.middle_name}
                  onChange={e => setForm(p => ({ ...p, middle_name: e.target.value }))}
                  placeholder="Введите отчество (необязательно)" />
              </label>
              <label className="field">
                <span className="field__label">Должность</span>
                <input className="input" value={form.position}
                  onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                  placeholder="Введите должность" />
              </label>
            </div>
          </div>
        </div>

        {/* Раздел: Контактные данные */}
        <div className="card profile-card">
          <div className="card__header">
            <ion-icon name="mail-outline" />
            Контактные данные
          </div>
          <div className="card__body">
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Логин</span>
                <input className="input" value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="Логин для входа" />
              </label>
              <label className="field">
                <span className="field__label">Email</span>
                <input type="email" className="input" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="Email для уведомлений" />
              </label>
            </div>
          </div>
        </div>

        {/* Раздел: Безопасность */}
        <div className="card profile-card">
          <div className="card__header">
            <ion-icon name="lock-closed-outline" />
            Безопасность
          </div>
          <div className="card__body">
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Текущий пароль</span>
                <input type="password" className="input" value={form.current_password}
                  onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))}
                  placeholder="Текущий пароль" autoComplete="current-password" />
              </label>
              <label className="field">
                <span className="field__label">Новый пароль</span>
                <input type="password" className="input" value={form.new_password}
                  onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))}
                  placeholder="Минимум 8 символов" autoComplete="new-password" />
              </label>
              <label className="field">
                <span className="field__label">Подтверждение пароля</span>
                <input type="password" className="input" value={form.confirm_password}
                  onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))}
                  placeholder="Повторите новый пароль" autoComplete="new-password" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Footer с кнопкой сохранения */}
      <div className="profile-footer">
        {error && <span className="profile-footer__error">{error}</span>}
        {saved && <span className="profile-footer__saved"><ion-icon name="checkmark-circle-outline" /> Сохранено</span>}
        <button className="btn btn-primary profile-footer__save" onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" /> : <ion-icon name="save-outline" />}
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}
