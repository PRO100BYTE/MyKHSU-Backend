const BASE = '/adminapi';

function getToken() {
  return localStorage.getItem('admin_token');
}

async function request(method, path, body, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin-panel/login';
    return null;
  }

  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
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

  // Расписание
  deletePairsTable: () => request('DELETE', '/deletetable'),
  uploadSchedule: (file, replace) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', replace ? '/createtable' : '/updatetable', fd, true);
  },
  updatePairs: (payload) => request('POST', '/updatepairs', payload),

  // Звонки
  updateTimes: (items) => request('POST', '/updatetimes', items),

  // Новости
  createNews: (content) => request('POST', '/createnews', { content }),
  editNews: (id, content) => request('POST', `/editnews?id=${id}`, { content }),
  deleteNews: (id) => request('DELETE', `/deletenews?id=${id}`),

  // Пользователи админ-панели
  getUsers: () => request('GET', '/users'),
  createUser: (payload) => request('POST', '/users', payload),
  updateUser: (id, payload) => request('PATCH', `/users/${id}`, payload),
  disableUser: (id) => request('POST', `/users/${id}/disable`),
  enableUser: (id) => request('POST', `/users/${id}/enable`),
  deleteUser: (id) => request('DELETE', `/users/${id}`),

  // Профиль текущего пользователя
  getProfile: () => request('GET', '/profile'),
  updateProfile: (payload) => request('PATCH', '/profile', payload),

  // Ручные каталоги курсов/групп
  getCatalogCourses: () => request('GET', '/catalog/courses'),
  createCatalogCourse: (course) => request('POST', '/catalog/courses', { course }),
  getCatalogGroups: (course) => request('GET', `/catalog/groups${course !== undefined ? `?course=${course}` : ''}`),
  createCatalogGroup: (payload) => request('POST', '/catalog/groups', payload),

  // Единое окно (тикеты)
  getUnifiedWindowTickets: (params = {}) => {
    const search = new URLSearchParams();
    if (params.status) search.set('status', params.status);
    if (params.role) search.set('role', params.role);
    if (params.limit) search.set('limit', String(params.limit));
    const suffix = search.toString();
    return request('GET', `/unified-window/tickets${suffix ? `?${suffix}` : ''}`);
  },
  updateUnifiedWindowTicket: (id, payload) => request('PATCH', `/unified-window/tickets/${id}`, payload),

  // Публичный API (чтение)
  getGroups: (course) =>
    fetch(`/api/getgroups${course !== undefined ? `?course=${course}` : ''}`).then(r => r.json()),
  getCourses: () =>
    fetch('/api/getcourses').then(r => r.json()),
  getWeekNumbers: () =>
    fetch('/api/weeknumbers').then(r => r.json()),
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
