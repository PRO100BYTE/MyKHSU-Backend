const BASE = '/adminapi';

function getToken() {
  return localStorage.getItem('admin_token');
}

function getResponseError(data, fallbackError) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      error: typeof data.error === 'string' && data.error.trim() ? data.error : fallbackError,
      code: typeof data.code === 'string' && data.code.trim() ? data.code : '',
    };
  }

  if (typeof data === 'string' && data.trim()) {
    return { error: data, code: '' };
  }

  return { error: fallbackError, code: '' };
}

async function request(method, path, body, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });

    const text = await res.text();
    let data = text;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const { error, code } = getResponseError(data, `HTTP ${res.status}`);

    if (res.status === 401 && token && path !== '/login') {
      localStorage.removeItem('admin_token');
      window.dispatchEvent(new CustomEvent('admin-auth-expired', {
        detail: {
          error,
          code: code || 'ADM-AUTH-008',
        },
      }));
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? '' : error,
      errorCode: res.ok ? '' : code,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : 'Network request failed',
      errorCode: 'UI-NET-001',
    };
  }
}

const api = {
  login: (username, password) =>
    request('POST', '/login', { username, password }),

  checkToken: () =>
    request('POST', '/checktoken'),

  // Сервисная информация
  getMeta: () =>
    fetch('/api/meta').then(r => r.json()),
  getDashboardSummary: () => request('GET', '/dashboard/summary'),

  // Расписание
  deletePairsTable: () => request('DELETE', '/deletetable'),
  uploadSchedule: (file, replace) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', replace ? '/createtable' : '/updatetable', fd, true);
  },
  updatePairs: (payload) => request('POST', '/updatepairs', payload),
  getPairs: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))).toString();
    return request('GET', `/pairs${qs ? '?' + qs : ''}`);
  },
  updatePair: (id, payload) => request('PUT', `/pairs/${id}`, payload),
  deletePair: (id) => request('DELETE', `/pairs/${id}`),
  exportSchedule: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    ).toString()
    return fetch(`${BASE}/schedule/export${qs ? `?${qs}` : ''}`, {
      headers: (() => {
        const token = getToken()
        return token ? { Authorization: `Bearer ${token}` } : {}
      })(),
    })
  },
  copySchedule: (payload) => request('POST', '/schedule/copy', payload),
  getCatalogCourses: () => request('GET', '/catalog/courses'),
  createCatalogCourse: (course) => request('POST', '/catalog/courses', { course }),
  deleteCatalogCourse: (course) => request('DELETE', `/catalog/courses/${encodeURIComponent(course)}`),
  getCatalogGroups: (course) => request('GET', `/catalog/groups${course !== undefined && course !== '' ? `?course=${course}` : ''}`),
  createCatalogGroup: (payload) => request('POST', '/catalog/groups', payload),
  updateCatalogGroup: (id, payload) => request('PATCH', `/catalog/groups/${id}`, payload),
  deleteCatalogGroup: (id) => request('DELETE', `/catalog/groups/${id}`),

  // Звонки
  updateTimes: (items) => request('POST', '/updatetimes', items),

  // Новости
  createNews: (content) => request('POST', '/createnews', { content }),
  editNews: (id, content) => request('POST', `/editnews?id=${id}`, { content }),
  deleteNews: (id) => request('DELETE', `/deletenews?id=${id}`),

  // Пользователи админ-панели
  getProfile: () => request('GET', '/profile'),
  updateProfile: (payload) => request('PATCH', '/profile', payload),

  getUsers: () => request('GET', '/users'),
  createUser: (payload) => request('POST', '/users', payload),
  updateUser: (id, payload) => request('PATCH', `/users/${id}`, payload),
  disableUser: (id) => request('POST', `/users/${id}/disable`),
  enableUser: (id) => request('POST', `/users/${id}/enable`),
  deleteUser: (id) => request('DELETE', `/users/${id}`),

  // История входов
  getLoginHistory: (limit = 100, offset = 0, userId = null) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (userId) qs.set('userId', String(userId));
    return request('GET', `/login-history?${qs.toString()}`);
  },
  getUserLoginHistory: (userId, limit = 50, offset = 0) =>
    request('GET', `/users/${userId}/login-history?limit=${limit}&offset=${offset}`),
  getUserLoginStats: (userId) =>
    request('GET', `/users/${userId}/login-stats`),

  // Единое окно
  getUwTickets: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString()
    return request('GET', `/unified-window/tickets${qs ? '?' + qs : ''}`)
  },
  getUwTicket: (id) => request('GET', `/unified-window/tickets/${id}`),
  postUwMessage: (ticketId, text) => request('POST', `/unified-window/tickets/${ticketId}/messages`, { text }),
  patchUwStatus: (ticketId, status, comment) => request('PATCH', `/unified-window/tickets/${ticketId}/status`, { status, comment }),
  deleteUwTicket: (ticketId) => request('DELETE', `/unified-window/tickets/${ticketId}`),
  uploadUwAttachment: (ticketId, file, messageId) => {
    const form = new FormData()
    form.append('file', file)
    if (messageId) form.append('message_id', messageId)
    return request('POST', `/unified-window/tickets/${ticketId}/attachments`, form, true)
  },
  getUwFileUrl: (fileId) => `/adminapi/unified-window/files/${fileId}`,

  // Публичный API (чтение)
  getGroups: (course) =>
    fetch(`/api/getgroups${course !== undefined ? `?course=${course}` : ''}`).then(r => r.json()),
  getCourses: () =>
    fetch('/api/getcourses').then(r => r.json()),
  getWeekNumbers: () =>
    fetch('/api/weeknumbers').then(r => r.json()),
  getDates: (week, filters = {}) => {
    const qs = new URLSearchParams({ week: String(week) })
    if (filters.course !== undefined && filters.course !== null && filters.course !== '') {
      qs.set('course', String(filters.course))
    }
    if (filters.group !== undefined && filters.group !== null && String(filters.group).trim() !== '') {
      qs.set('group', String(filters.group).trim())
    }
    return fetch(`/api/getdates?${qs.toString()}`).then(r => r.json())
  },
  getPairsTime: () =>
    fetch('/api/getpairstime?include_id=true').then(r => r.json()),
  getNews: (amount = 20, from = 0) =>
    fetch(`/api/news?amount=${amount}&from=${from}&include_id=true`).then(r => r.json()),
  getLastUpdate: () =>
    fetch('/api/lastupdate').then(r => r.json()),
  getMainColumns: () =>
    fetch('/api/getmaincolumns').then(r => r.json()),
};

export default api;
