import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { hasPermission } from '../utils/permissions';

export default function LoginHistoryScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: 100, offset: 0, pages: 0 });
  const [filter, setFilter] = useState({
    userId: '',
  });
  const [sortBy, setSortBy] = useState('date_desc');

  // Проверяем доступ
  useEffect(() => {
    if (!user || !hasPermission(user.role, 'users:read')) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const loadHistory = useCallback(async (limit = 100, offset = 0, userId = null) => {
    setLoading(true);
    setError('');
    try {
      const resp = await api.getLoginHistory(limit, offset, userId);
      if (!resp.ok) {
        setError(resp.error || 'Не удалось загрузить историю входов');
        return;
      }

      let data = resp.data?.data || [];

      // Сортировка
      if (sortBy === 'date_asc') {
        data = data.sort((a, b) => new Date(a.login_timestamp) - new Date(b.login_timestamp));
      }

      setHistory(data);
      setPagination(resp.data?.pagination || { total: 0, limit, offset, pages: 0 });
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    loadHistory(pagination.limit, pagination.offset, filter.userId || null);
  }, [filter.userId, sortBy]);

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      const newOffset = Math.max(0, pagination.offset - pagination.limit);
      loadHistory(pagination.limit, newOffset, filter.userId || null);
      setPagination(prev => ({ ...prev, offset: newOffset }));
    }
  };

  const handleNextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      const newOffset = pagination.offset + pagination.limit;
      loadHistory(pagination.limit, newOffset, filter.userId || null);
      setPagination(prev => ({ ...prev, offset: newOffset }));
    }
  };

  return (
    <div className="screen-stack login-history-screen">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="log-in-outline" />
        </div>
        <div>
          <div className="screen-hero__title">История входов</div>
          <div className="screen-hero__sub">Все попытки входа в админ-панель с деталями устройства и сети</div>
        </div>
      </div>

      <div className="card login-history-filters-card">
        <div className="card__header">
          <div>
            <div className="card__title">Фильтры</div>
            <div className="card__subtitle">Поиск и сортировка по журналу входов</div>
          </div>
        </div>
        <div className="card__body">
          <div className="form-grid login-history-filters-grid">
            <label className="field">
              <span className="field__label">ID пользователя (опционально)</span>
              <input
                type="text"
                className="input"
                placeholder="Введите ID пользователя"
                value={filter.userId}
                onChange={e => setFilter(prev => ({ ...prev, userId: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field__label">Сортировка</span>
              <select
                className="input"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="date_desc">Новые сверху</option>
                <option value="date_asc">Старые сверху</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Журнал входов</div>
            <div className="card__subtitle">
              Всего записей: {pagination.total}
            </div>
          </div>
        </div>
        {error && (
          <div className="alert alert-error login-history-alert">
            <ion-icon name="alert-circle-outline" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <span className="spinner spinner-lg" />
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <ion-icon name="log-in-outline" />
            <div className="empty-state__title">История входов пуста</div>
            <div className="empty-state__description">Появится после первой успешной авторизации</div>
          </div>
        ) : (
          <>
            <div className="table-wrap login-history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Дата и время</th>
                    <th>Пользователь</th>
                    <th>IP адрес</th>
                    <th>ОС</th>
                    <th>Браузер</th>
                    <th>Модель устройства</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, idx) => {
                    const timestamp = new Date(entry.login_timestamp);
                    const dateStr = timestamp.toLocaleDateString('ru-RU');
                    const timeStr = timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const fullName = [entry.last_name, entry.first_name].filter(Boolean).join(' ');

                    return (
                      <tr key={idx}>
                        <td className="table-cell-muted">{dateStr} {timeStr}</td>
                        <td>
                          <div className="login-history-user-cell">
                            <div className="table-cell-strong">{entry.username || '—'}</div>
                            {entry.first_name && (
                              <div className="table-cell-muted table-cell-muted--weak">
                                {fullName || entry.first_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="login-history-code">{entry.ip_address || '—'}</span>
                        </td>
                        <td>
                          <span className="badge badge-gray">
                            {entry.device_os ? `${entry.device_os}${entry.device_os_version ? ` ${entry.device_os_version}` : ''}` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-gray">
                            {entry.browser_name ? `${entry.browser_name}${entry.browser_version ? ` ${entry.browser_version}` : ''}` : '—'}
                          </span>
                        </td>
                        <td className="table-cell-muted">{entry.device_model || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="login-history-pagination">
              <div className="login-history-pagination__info">
                Всего: {pagination.total} • Страница {Math.floor(pagination.offset / pagination.limit) + 1} из {pagination.pages || 1}
              </div>
              <div className="login-history-pagination__controls">
                <button
                  className="btn btn-ghost"
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0}
                >
                  <ion-icon name="chevron-back-outline" />
                  Предыдущая
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={handleNextPage}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                >
                  Следующая
                  <ion-icon name="chevron-forward-outline" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
