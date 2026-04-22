import React from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import NewsScreen from './screens/NewsScreen';
import TimesScreen from './screens/TimesScreen';
import UsersScreen from './screens/UsersScreen';
import { ADMIN_UI } from './constants';

const NAV_ITEMS = [
  { to: '/dashboard', icon: 'grid-outline',         label: 'Дашборд' },
  { to: '/schedule',  icon: 'calendar-outline',      label: 'Расписание' },
  { to: '/times',     icon: 'alarm-outline',          label: 'Звонки' },
  { to: '/news',      icon: 'newspaper-outline',      label: 'Новости' },
  { to: '/users',     icon: 'people-outline',         label: 'Пользователи' },
];

const TITLES = {
  '/dashboard': 'Дашборд',
  '/schedule':  'Расписание',
  '/times':     'Расписание звонков',
  '/news':      'Новости',
  '/users':     'Пользователи',
};

export default function App() {
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();

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
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">{ADMIN_UI.logoText}</div>
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
            >
              <ion-icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user.username?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="sidebar__user-name">{user.username}</div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header__title">{title}</div>
          <div className="admin-header__actions">
            <button className="theme-toggle" onClick={toggle} title="Сменить тему">
              <ion-icon name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} />
            </button>
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button
      className="sidebar__logout"
      onClick={logout}
      title="Выйти"
    >
      <ion-icon name="log-out-outline" />
    </button>
  );
}
