export const ADMIN_ACCENT_COLORS = {
  green: {
    key: 'green',
    label: 'Зеленый',
    primary: '#10B981',
    light: '#ECFDF5',
    dark: '#047857',
    glass: 'rgba(16, 185, 129, 0.12)',
    glassBorder: 'rgba(16, 185, 129, 0.25)',
  },
  blue: {
    key: 'blue',
    label: 'Голубой',
    primary: '#3B82F6',
    light: '#DBEAFE',
    dark: '#1D4ED8',
    glass: 'rgba(59, 130, 246, 0.12)',
    glassBorder: 'rgba(59, 130, 246, 0.25)',
  },
  purple: {
    key: 'purple',
    label: 'Фиолетовый',
    primary: '#8B5CF6',
    light: '#EDE9FE',
    dark: '#5B21B6',
    glass: 'rgba(139, 92, 246, 0.12)',
    glassBorder: 'rgba(139, 92, 246, 0.25)',
  },
  orange: {
    key: 'orange',
    label: 'Оранжевый',
    primary: '#F97316',
    light: '#FFF7ED',
    dark: '#C2410C',
    glass: 'rgba(249, 115, 22, 0.12)',
    glassBorder: 'rgba(249, 115, 22, 0.25)',
  },
  matrix: {
    key: 'matrix',
    label: 'Матрица',
    primary: '#00FF41',
    light: '#0D1A0F',
    dark: '#00CC33',
    glass: 'rgba(0, 255, 65, 0.12)',
    glassBorder: 'rgba(0, 255, 65, 0.25)',
  },
  legend: {
    key: 'legend',
    label: 'Легенда',
    primary: '#FFD666',
    light: '#FFF7E0',
    dark: '#8A6A1F',
    glass: 'rgba(255, 214, 102, 0.14)',
    glassBorder: 'rgba(255, 214, 102, 0.28)',
  },
};

export const ADMIN_THEMES = {
  light: {
    key: 'light',
    label: 'Светлая',
    icon: 'sunny-outline',
  },
  dark: {
    key: 'dark',
    label: 'Темная',
    icon: 'moon-outline',
  },
  matrix: {
    key: 'matrix',
    label: 'Матрица',
    icon: 'code-slash-outline',
  },
  legend: {
    key: 'legend',
    label: 'Легенда',
    icon: 'trophy-outline',
  },
};

export const ADMIN_UI = {
  brandTitle: 'Мой ИТИ ХГУ',
  brandSubTitle: 'Панель управления',
  loginSubTitle: 'Панель управления расписанием, новостями и пользователями',
  accentOptions: ['green', 'blue', 'purple', 'orange', 'matrix', 'legend'],
  themeOptions: ['dark', 'light', 'matrix', 'legend'],
};

export const BUILD_INFO_FALLBACK = {
  api_version: process.env.REACT_APP_API_VERSION || '1.1.0',
  app_version: process.env.REACT_APP_APP_VERSION || '1.1.0',
  admin_panel_version: process.env.REACT_APP_ADMIN_PANEL_VERSION || '1.1.0',
  frontend_version: process.env.REACT_APP_FRONTEND_VERSION || '1.1.0',
  build_number: process.env.REACT_APP_BUILD_NUMBER || '2026.04.22.1',
  build_date: process.env.REACT_APP_BUILD_DATE || '2026-04-22T00:00:00+07:00',
  build_date_human: process.env.REACT_APP_BUILD_DATE_HUMAN || '22.04.2026, 00:00:00',
  git_commit_hash: process.env.REACT_APP_GIT_COMMIT_HASH || 'unknown',
  build_timezone: process.env.REACT_APP_BUILD_TIMEZONE || 'Asia/Krasnoyarsk',
  build_timezone_label: process.env.REACT_APP_BUILD_TIMEZONE_LABEL || 'Asia/Krasnoyarsk (GMT+7)',
};
