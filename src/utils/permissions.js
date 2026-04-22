/**
 * Ролевая модель доступа (RBAC) для MyKHSU Backend.
 * Роли: admin, schedule_dispatcher, news_editor, manager, unified_window_agent
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  SCHEDULE_DISPATCHER: 'schedule_dispatcher',
  NEWS_EDITOR: 'news_editor',
  MANAGER: 'manager',
  UNIFIED_WINDOW_AGENT: 'unified_window_agent',
}

const ROLE_PERMISSIONS = {
  admin: ['*'],
  schedule_dispatcher: [
    'schedule:read', 'schedule:write',
    'times:write',
    'catalog:write',
  ],
  news_editor: [
    'news:read', 'news:write',
  ],
  manager: [
    'schedule:read', 'schedule:write',
    'times:write',
    'catalog:write',
    'news:read', 'news:write',
  ],
  unified_window_agent: [
    'unified_window:read', 'unified_window:write',
  ],
}

/**
 * Проверяет, есть ли у роли нужное разрешение.
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

/**
 * Возвращает список разрешений для роли.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? []
}
