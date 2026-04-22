export const USER_ROLES = {
  ADMIN: 'admin',
  SCHEDULE_DISPATCHER: 'schedule_dispatcher',
  NEWS_EDITOR: 'news_editor',
  MANAGER: 'manager',
  UNIFIED_WINDOW_AGENT: 'unified_window_agent',
}

const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: ['*'],
  [USER_ROLES.SCHEDULE_DISPATCHER]: [
    'schedule:read',
    'schedule:write',
    'times:write',
    'catalog:write',
  ],
  [USER_ROLES.NEWS_EDITOR]: [
    'news:read',
    'news:write',
  ],
  [USER_ROLES.MANAGER]: [
    'schedule:read',
    'schedule:write',
    'times:write',
    'catalog:write',
    'news:read',
    'news:write',
  ],
  [USER_ROLES.UNIFIED_WINDOW_AGENT]: [
    'unified_window:read',
    'unified_window:write',
  ],
}

export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || []
}

export function hasPermission(role, permission) {
  const perms = getPermissionsForRole(role)
  return perms.includes('*') || perms.includes(permission)
}

export const AVAILABLE_ROLES = Object.values(USER_ROLES)
