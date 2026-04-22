import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import ProfileScreen from './screens/ProfileScreen';
import BrandMark from './components/BrandMark';
import { ADMIN_UI } from './constants';

const NAV_ITEMS = [
  { to: '/dashboard', icon: 'grid-outline',         label: 'Дашборд', requiredPerms: [] },
  { to: '/schedule',  icon: 'calendar-outline',      label: 'Расписание', requiredPerms: ['schedule:write'] },
  { to: '/times',     icon: 'alarm-outline',          label: 'Звонки', requiredPerms: ['times:write'] },
  { to: '/news',      icon: 'newspaper-outline',      label: 'Новости', requiredPerms: ['news:write'] },
  { to: '/users',     icon: 'people-outline',         label: 'Пользователи', requiredPerms: ['users:write'] },
  { to: '/unified-window', icon: 'mail-open-outline', label: 'Единое окно', requiredPerms: ['unified_window:write'] },
];

export default function App() {
  const { user, loading, hasPermission } = useAuth();
  const { showNavLabels, uiDensity } = useTheme();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 768);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const onResize = () => setSidebarCollapsed(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname, sidebarCollapsed]);

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

  // Фильтруем nav items по правам
  const visibleNavItems = NAV_ITEMS.filter(item =>
    item.requiredPerms.length === 0 || item.requiredPerms.some(p => hasPermission(p))
  );

  const currentPath = '/' + location.pathname.split('/').slice(-1)[0];
  const TITLES = {
    '/dashboard': 'Дашборд',
    '/schedule':  'Расписание',
    '/times':     'Расписание звонков',
    '/news':      'Новости',
    '/users':     'Пользователи',
    '/unified-window': 'Единое окно',
    '/appearance': 'Внешний вид',
  };
  const title = TITLES[currentPath] ?? 'Панель администратора';

  return (
    <div className={`admin-layout${uiDensity === 'compact' ? ' admin-layout--compact' : ''}`}>
      <div className="admin-layout__glow admin-layout__glow--primary" />
      <div className="admin-layout__glow admin-layout__glow--secondary" />
      <div className="admin-layout__noise" />

      {/* Sidebar */}
      <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
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
          {visibleNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}
              title={sidebarCollapsed || !showNavLabels ? item.label : undefined}
            >
              <ion-icon name={item.icon} />
              {!sidebarCollapsed && showNavLabels ? <span className="sidebar__item-label">{item.label}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__collapse-btn sidebar__collapse-btn--footer" onClick={toggleSidebar} title={sidebarCollapsed ? 'Развернуть' : 'Свернуть'}>
            <ion-icon name={sidebarCollapsed ? 'chevron-forward-outline' : 'chevron-back-outline'} />
            {!sidebarCollapsed && <span>Свернуть меню</span>}
          </button>

          <div className="sidebar__user-menu" ref={profileMenuRef}>
            <button className="sidebar__user-trigger" type="button" onClick={() => setProfileMenuOpen(v => !v)}>
              <div className="sidebar__avatar">
                {user.first_name ? user.first_name[0].toUpperCase() : user.username?.[0]?.toUpperCase() ?? 'A'}
              </div>
              {!sidebarCollapsed && (
                <div className="sidebar__user-name">
                  {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                </div>
              )}
              {!sidebarCollapsed && <ion-icon name={profileMenuOpen ? 'chevron-down-outline' : 'chevron-up-outline'} />}
            </button>
            <div className={`profile-menu${profileMenuOpen ? ' profile-menu--open' : ''}`}>
              <NavLink to="/profile" className="profile-menu__item">
                <ion-icon name="person-outline" />
                Профиль
              </NavLink>
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
        </header>

        <main className="admin-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/schedule/*" element={<ProtectedRoute requiredPerms={['schedule:write']}><ScheduleScreen /></ProtectedRoute>} />
            <Route path="/times" element={<ProtectedRoute requiredPerms={['times:write']}><TimesScreen /></ProtectedRoute>} />
            <Route path="/news" element={<ProtectedRoute requiredPerms={['news:write']}><NewsScreen /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPerms={['users:write']}><UsersScreen /></ProtectedRoute>} />
            <Route path="/unified-window" element={<ProtectedRoute requiredPerms={['unified_window:write']}><UnifiedWindowScreen /></ProtectedRoute>} />
            <Route path="/appearance" element={<AppearanceScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

    </div>
  );
}

function ProtectedRoute({ requiredPerms, children }) {
  const { hasPermission } = useAuth();
  
  // Проверяем есть ли хотя бы одно необходимое право
  const hasAccess = requiredPerms.length === 0 || requiredPerms.some(p => hasPermission(p));
  
  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--text-secondary)' }}>
        <ion-icon name="lock-closed-outline" style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--text-tertiary)' }} />
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Доступ закрыт</div>
        <div style={{ fontSize: '14px', textAlign: 'center' }}>У вас нет прав для просмотра этого раздела</div>
      </div>
    );
  }
  
  return children;
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
