import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  username: '',
  password: '',
  is_active: true,
};

export default function UsersScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.getUsers();
    if (res?.ok) {
      setItems(res.data ?? []);
      setError('');
    } else {
      setError(res?.data?.error ?? 'Не удалось загрузить пользователей');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.username.localeCompare(b.username, 'ru')),
    [items]
  );

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
    setError('');
  }

  function openEdit(target) {
    setEditTarget(target);
    setForm({
      username: target.username,
      password: '',
      is_active: Boolean(target.is_active),
    });
    setIsModalOpen(true);
    setError('');
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      username: form.username.trim(),
      is_active: Boolean(form.is_active),
    };

    if (!editTarget || form.password.trim()) {
      payload.password = form.password;
    }

    const res = editTarget
      ? await api.updateUser(editTarget.id, payload)
      : await api.createUser(payload);

    setSaving(false);

    if (!res?.ok) {
      setError(res?.data?.error ?? 'Не удалось сохранить пользователя');
      return;
    }

    setOkMessage(editTarget ? 'Пользователь обновлен' : 'Пользователь создан');
    closeModal();
    await loadUsers();
  }

  async function toggleStatus(target) {
    setSaving(true);
    setError('');
    const res = target.is_active
      ? await api.disableUser(target.id)
      : await api.enableUser(target.id);
    setSaving(false);

    if (!res?.ok) {
      setError(res?.data?.error ?? 'Не удалось обновить статус');
      return;
    }

    setOkMessage(target.is_active ? 'Пользователь отключен' : 'Пользователь включен');
    await loadUsers();
  }

  async function removeUser(target) {
    if (!window.confirm(`Удалить пользователя "${target.username}"?`)) return;

    setSaving(true);
    setError('');
    const res = await api.deleteUser(target.id);
    setSaving(false);

    if (!res?.ok) {
      setError(res?.data?.error ?? 'Не удалось удалить пользователя');
      return;
    }

    setOkMessage('Пользователь удален');
    await loadUsers();
  }

  return (
    <div className="screen-stack">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="people-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Пользователи</div>
          <div className="screen-hero__sub">Управление доступом к административной панели</div>
        </div>
      </div>

      {okMessage && <div className="alert alert-success"><ion-icon name="checkmark-circle-outline" />{okMessage}</div>}
      {error && <div className="alert alert-error"><ion-icon name="warning-outline" />{error}</div>}

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Пользователи админки</div>
            <div className="card__subtitle">Создание, редактирование, отключение и удаление</div>
          </div>
          <button className="btn btn-primary" onClick={openCreate} disabled={saving}>
            <ion-icon name="person-add-outline" />
            Добавить пользователя
          </button>
        </div>

        <div className="card__body">
          {loading ? (
            <div className="empty-state"><span className="spinner spinner-lg" /></div>
          ) : !sortedItems.length ? (
            <div className="empty-state">
              <ion-icon name="people-outline" />
              <div className="empty-state__title">Пользователей пока нет</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Логин</th>
                    <th>Статус</th>
                    <th>Создан</th>
                    <th>Обновлен</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map(item => {
                    const isSelf = user?.uid === item.id || user?.username === item.username;
                    return (
                      <tr key={item.id}>
                        <td className="table-cell-strong">{item.username}</td>
                        <td>
                          <span className={`badge ${item.is_active ? 'badge-green' : 'badge-gray'}`}>
                            {item.is_active ? 'Активен' : 'Отключен'}
                          </span>
                        </td>
                        <td>{formatDate(item.created_at)}</td>
                        <td>{formatDate(item.updated_at)}</td>
                        <td>
                          <div className="table-actions-inline table-actions-inline--wrap">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} disabled={saving}>
                              <ion-icon name="create-outline" />
                              Редактировать
                            </button>

                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleStatus(item)}
                              disabled={saving || isSelf}
                              title={isSelf ? 'Нельзя менять статус своей учетной записи' : ''}
                            >
                              <ion-icon name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'} />
                              {item.is_active ? 'Отключить' : 'Включить'}
                            </button>

                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => removeUser(item)}
                              disabled={saving || isSelf}
                              title={isSelf ? 'Нельзя удалить свою учетную запись' : ''}
                            >
                              <ion-icon name="trash-outline" />
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">{editTarget ? 'Редактирование пользователя' : 'Новый пользователь'}</div>
              <button className="btn-icon" onClick={closeModal}><ion-icon name="close-outline" /></button>
            </div>

            <form className="modal__body" onSubmit={onSubmit}>
              <div className="form-group">
                <label className="form-label">Логин</label>
                <input
                  className="form-input"
                  value={form.username}
                  onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                  required
                  minLength={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Пароль {editTarget ? '(оставьте пустым, чтобы не менять)' : ''}</label>
                <input
                  className="form-input"
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  type="password"
                  minLength={editTarget ? undefined : 8}
                  required={!editTarget}
                />
              </div>

              <label className="switch-row">
                <span>
                  <strong>Учетная запись активна</strong>
                  <small>Если выключить, пользователь не сможет войти</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              </label>

              <div className="modal__footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : <ion-icon name="save-outline" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU');
}
