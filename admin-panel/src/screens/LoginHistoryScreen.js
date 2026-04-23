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
    username: '',
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
    <div className="admin-screen">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header__title">
          <ion-icon name="log-in-outline" className="admin-header__icon" />
          История входов
        </div>
        <div className="admin-header__subtitle">
          Все входы в админку
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__header">
          <ion-icon name="filter-outline" />
          Фильтры
        </div>
        <div className="card__body">
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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

      {/* Content */}
      <div className="card">
        {error && (
          <div className="alert alert-error">
            <ion-icon name="alert-circle-outline" />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <span className="spinner spinner-lg" />
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <ion-icon name="calendar-outline" />
            <div>Нет записей о входах</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
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

                    return (
                      <tr key={idx}>
                        <td className="table__cell">{dateStr} {timeStr}</td>
                        <td className="table__cell">
                          <div>
                            <div className="table__text-strong">{entry.username}</div>
                            {entry.first_name && (
                              <div className="table__text-secondary">
                                {entry.last_name && entry.first_name ? `${entry.last_name} ${entry.first_name}` : entry.first_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="table__cell table__text-code">{entry.ip_address || '—'}</td>
                        <td className="table__cell">
                          <span className="badge badge-info">
                            {entry.device_os}{entry.device_os_version ? ` ${entry.device_os_version}` : ''}
                          </span>
                        </td>
                        <td className="table__cell">
                          <span className="badge badge-info">
                            {entry.browser_name}{entry.browser_version ? ` ${entry.browser_version}` : ''}
                          </span>
                        </td>
                        <td className="table__cell">{entry.device_model || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="table-pagination">
              <div className="table-pagination__info">
                Всего: {pagination.total} • Страница {Math.floor(pagination.offset / pagination.limit) + 1} из {pagination.pages || 1}
              </div>
              <div className="table-pagination__controls">
                <button
                  className="btn btn-secondary"
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0}
                >
                  <ion-icon name="chevron-back-outline" />
                  Предыдущая
                </button>
                <button
                  className="btn btn-secondary"
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
