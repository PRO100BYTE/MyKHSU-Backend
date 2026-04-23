// Утилита для проверки прав доступа в админке
// На основе структуры прав с бэкенда

export const ROLE_PERMISSIONS = {
  admin: [
    'schedule:read', 'schedule:write',
    'times:read', 'times:write',
    'news:read', 'news:write',
    'users:read', 'users:write',
    'unified_window:read', 'unified_window:write',
    'catalog:read', 'catalog:write',
  ],
  schedule_dispatcher: [
    'schedule:read', 'schedule:write',
    'times:read', 'times:write',
    'catalog:read', 'catalog:write',
  ],
  news_editor: [
    'news:read', 'news:write',
  ],
  manager: [
    'schedule:read',
    'news:read',
    'users:read',
    'unified_window:read',
  ],
  unified_window_agent: [
    'unified_window:read', 'unified_window:write',
  ],
};

/**
 * Проверяет, есть ли у роли конкретное право
 * @param {string} role - Роль пользователя
 * @param {string} permission - Требуемое право (например, 'users:read')
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

/**
 * Проверяет, есть ли у роли любое из указанных прав
 * @param {string} role - Роль пользователя
 * @param {string[]} permissions - Массив требуемых прав
 * @returns {boolean}
 */
export function hasAnyPermission(role, permissions) {
  if (!role || !Array.isArray(permissions)) return false;
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Проверяет, есть ли у роли все указанные права
 * @param {string} role - Роль пользователя
 * @param {string[]} permissions - Массив требуемых прав
 * @returns {boolean}
 */
export function hasAllPermissions(role, permissions) {
  if (!role || !Array.isArray(permissions)) return false;
  return permissions.every(p => hasPermission(role, p));
}
