import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import api from './api';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import NewsScreen from './screens/NewsScreen';
import TimesScreen from './screens/TimesScreen';
import UsersScreen from './screens/UsersScreen';
import AppearanceScreen from './screens/AppearanceScreen';
import UnifiedWindowScreen from './screens/UnifiedWindowScreen';
import BrandMark from './components/BrandMark';
import { ADMIN_UI } from './constants';

const NAV_ITEMS = [
  { to: '/dashboard', icon: 'grid-outline',         label: 'Дашборд' },
  { to: '/schedule',  icon: 'calendar-outline',      label: 'Расписание' },
  { to: '/times',     icon: 'alarm-outline',          label: 'Звонки' },
  { to: '/news',      icon: 'newspaper-outline',      label: 'Новости' },
  { to: '/users',     icon: 'people-outline',         label: 'Пользователи' },
  { to: '/unified-window', icon: 'mail-open-outline', label: 'Единое окно' },
];

const TITLES = {
  '/dashboard': 'Дашборд',
  '/schedule':  'Расписание',
  '/times':     'Расписание звонков',
  '/news':      'Новости',
  '/users':     'Пользователи',
  '/unified-window': 'Единое окно',
  '/appearance': 'Внешний вид',
};

export default function App() {
  const { user, loading } = useAuth();
  const { showNavLabels, uiDensity } = useTheme();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    position: '',
    email: '',
    current_password: '',
    new_password: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!profileOpen) return;

    let mounted = true;
    (async () => {
      const resp = await api.getProfile();
      if (!mounted || !resp?.ok) return;
      const data = resp.data || {};
      setProfileForm(prev => ({
        ...prev,
        username: data.username || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        position: data.position || '',
        email: data.email || '',
      }));
    })();

    return () => { mounted = false; };
  }, [profileOpen]);

  const saveProfile = async () => {
    setProfileSaving(true);
    const payload = {
      username: profileForm.username,
      first_name: profileForm.first_name,
      last_name: profileForm.last_name,
      position: profileForm.position,
      email: profileForm.email,
    };
    if (profileForm.new_password) {
      payload.current_password = profileForm.current_password;
      payload.new_password = profileForm.new_password;
    }

    const resp = await api.updateProfile(payload);
    setProfileSaving(false);
    if (!resp?.ok) {
      alert(resp?.data?.error || 'Не удалось обновить профиль');
      return;
    }

    setProfileForm(prev => ({ ...prev, current_password: '', new_password: '' }));
    alert('Профиль обновлён');
    setProfileOpen(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!user) {
    if (location.pathname !== '/login') return <Navigate to="/login" replace />;
    return <Routes><Route path="/login" element={<LoginScreen />} /></Routes>;
  }

  const currentPath = '/' + location.pathname.split('/').slice(-1)[0];
  const title = TITLES[currentPath] ?? 'Панель администратора';

  return (
    <div className={`admin-layout${uiDensity === 'compact' ? ' admin-layout--compact' : ''}`}>
      <div className="admin-layout__glow admin-layout__glow--primary" />
      <div className="admin-layout__glow admin-layout__glow--secondary" />
      <div className="admin-layout__noise" />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo-wrap">
            <BrandMark className="sidebar__logo" />
          </div>
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-title">{ADMIN_UI.brandTitle}</div>
            <div className="sidebar__brand-sub">{ADMIN_UI.brandSubTitle}</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__section-label">Навигация</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}
              title={!showNavLabels ? item.label : undefined}
            >
              <ion-icon name={item.icon} />
              {showNavLabels ? <span className="sidebar__item-label">{item.label}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user-menu">
            <button className="sidebar__user-trigger" type="button">
              <div className="sidebar__avatar">
                {user.username?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="sidebar__user-name">{user.username}</div>
              <ion-icon name="chevron-up-outline" />
            </button>
            <div className="profile-menu">
              <button className="profile-menu__item" onClick={() => setProfileOpen(true)}>
                <ion-icon name="person-outline" />
                Профиль
              </button>
              <NavLink to="/appearance" className="profile-menu__item">
                <ion-icon name="color-palette-outline" />
                Внешний вид
              </NavLink>
              <LogoutButton menu />
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header__title-wrap">
            <div className="admin-header__eyebrow">Control Center</div>
            <div className="admin-header__title">{title}</div>
          </div>
          <div className="admin-header__actions">
            <div className="admin-header__meta-chip">{ADMIN_UI.brandSubTitle}</div>
          </div>
        </header>

        <main className="admin-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/schedule/*" element={<ScheduleScreen />} />
            <Route path="/times" element={<TimesScreen />} />
            <Route path="/news" element={<NewsScreen />} />
            <Route path="/users" element={<UsersScreen />} />
            <Route path="/unified-window" element={<UnifiedWindowScreen />} />
            <Route path="/appearance" element={<AppearanceScreen />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {profileOpen ? (
        <div className="modal-overlay" onClick={() => setProfileOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Профиль пользователя</h3>
            </div>
            <div className="form-grid" style={{ gap: 12 }}>
              <label className="field">
                <span className="field__label">Логин</span>
                <input className="input" value={profileForm.username} onChange={e => setProfileForm(p => ({ ...p, username: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Имя</span>
                <input className="input" value={profileForm.first_name} onChange={e => setProfileForm(p => ({ ...p, first_name: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Фамилия</span>
                <input className="input" value={profileForm.last_name} onChange={e => setProfileForm(p => ({ ...p, last_name: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Должность</span>
                <input className="input" value={profileForm.position} onChange={e => setProfileForm(p => ({ ...p, position: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Email для уведомлений/восстановления</span>
                <input type="email" className="input" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Текущий пароль</span>
                <input type="password" className="input" value={profileForm.current_password} onChange={e => setProfileForm(p => ({ ...p, current_password: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Новый пароль</span>
                <input type="password" className="input" value={profileForm.new_password} onChange={e => setProfileForm(p => ({ ...p, new_password: e.target.value }))} />
              </label>
            </div>
            <div className="modal__footer">
              <button className="btn" onClick={() => setProfileOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LogoutButton({ menu = false }) {
  const { logout } = useAuth();
  return (
    <button
      className={menu ? 'profile-menu__item profile-menu__item--danger' : 'sidebar__logout'}
      onClick={logout}
      title="Выйти"
    >
      <ion-icon name="log-out-outline" />
      {menu ? 'Выйти' : null}
    </button>
  );
}
