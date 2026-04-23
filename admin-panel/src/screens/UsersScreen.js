import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const EMPTY_FORM = {
  username: '',
  password: '',
  is_active: true,
  role: 'admin',
  first_name: '',
  middle_name: '',
  last_name: '',
  position: '',
  email: '',
};

const ROLE_LABELS = {
  admin: 'Админ',
  schedule_dispatcher: 'Диспетчер расписания',
  news_editor: 'Редактор новостей',
  manager: 'Менеджер',
  unified_window_agent: 'Агент единого окна',
};

const ROLE_PERMISSIONS = {
  admin: {
    desc: 'Полный доступ ко всем разделам и функциям системы.',
    perms: ['Расписание (чтение/запись)', 'Звонки (чтение/запись)', 'Новости (чтение/запись)', 'Пользователи (управление)', 'Единое окно (все функции)', 'Внешний вид', 'Профиль'],
  },
  schedule_dispatcher: {
    desc: 'Управление расписанием занятий и расписанием звонков.',
    perms: ['Расписание (чтение/запись)', 'Звонки (чтение/запись)', 'Профиль'],
  },
  news_editor: {
    desc: 'Создание и редактирование новостей.',
    perms: ['Новости (чтение/запись)', 'Профиль'],
  },
  manager: {
    desc: 'Просмотр расписания, новостей и единого окна без права изменений.',
    perms: ['Расписание (чтение)', 'Новости (чтение)', 'Единое окно (чтение)', 'Профиль'],
  },
  unified_window_agent: {
    desc: 'Работа с обращениями единого окна: ответы и смена статусов.',
    perms: ['Единое окно (чтение/ответы/смена статуса)', 'Профиль'],
  },
};

export default function UsersScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.getUsers();
    if (res?.ok) {
      setItems(res.data ?? []);
    } else {
      showToast({
        variant: 'error',
        title: 'Не удалось загрузить пользователей.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-USR-001',
      });
    }
    setLoading(false);
  }, [showToast]);

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
  }

  function openEdit(target) {
    setEditTarget(target);
    setForm({
      username: target.username,
      password: '',
      is_active: Boolean(target.is_active),
      role: target.role ?? 'admin',
      first_name: target.first_name ?? '',
      middle_name: target.middle_name ?? '',
      last_name: target.last_name ?? '',
      position: target.position ?? '',
      email: target.email ?? '',
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      username: form.username.trim(),
      is_active: Boolean(form.is_active),
      role: form.role,
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim(),
      last_name: form.last_name.trim(),
      position: form.position.trim(),
      email: form.email.trim(),
    };

    if (!editTarget || form.password.trim()) {
      payload.password = form.password;
    }

    const res = editTarget
      ? await api.updateUser(editTarget.id, payload)
      : await api.createUser(payload);

    setSaving(false);

    if (!res?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось сохранить пользователя.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-USR-002',
      });
      return;
    }

    showToast({ variant: 'success', title: editTarget ? 'Пользователь обновлен.' : 'Пользователь создан.' });
    closeModal();
    await loadUsers();
  }

  async function toggleStatus(target) {
    setSaving(true);
    const res = target.is_active
      ? await api.disableUser(target.id)
      : await api.enableUser(target.id);
    setSaving(false);

    if (!res?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось обновить статус пользователя.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-USR-003',
      });
      return;
    }

    showToast({ variant: 'success', title: target.is_active ? 'Пользователь отключен.' : 'Пользователь включен.' });
    await loadUsers();
  }

  async function removeUser(target) {
    if (!window.confirm(`Удалить пользователя "${target.username}"?`)) return;

    setSaving(true);
    const res = await api.deleteUser(target.id);
    setSaving(false);

    if (!res?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось удалить пользователя.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-USR-004',
      });
      return;
    }

    showToast({ variant: 'success', title: 'Пользователь удален.' });
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
                    <th>ФИО</th>
                    <th>Должность</th>
                    <th>Email</th>
                    <th>Роль</th>
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
                        <td>{[item.last_name, item.first_name, item.middle_name].filter(Boolean).join(' ') || '—'}</td>
                        <td>{item.position || '—'}</td>
                        <td>{item.email || '—'}</td>
                        <td>
                          <span className="badge badge-blue">
                            {ROLE_LABELS[item.role] ?? item.role ?? 'admin'}
                          </span>
                        </td>
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

              <div className="form-group">
                <label className="form-label">Имя</label>
                <input
                  className="form-input"
                  value={form.first_name}
                  onChange={e => setForm(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Отчество</label>
                <input
                  className="form-input"
                  value={form.middle_name}
                  onChange={e => setForm(prev => ({ ...prev, middle_name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Фамилия</label>
                <input
                  className="form-input"
                  value={form.last_name}
                  onChange={e => setForm(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Должность</label>
                <input
                  className="form-input"
                  value={form.position}
                  onChange={e => setForm(prev => ({ ...prev, position: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
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

              <div className="form-group">
                <label className="form-label">Роль</label>
                <select
                  className="form-input"
                  value={form.role}
                  onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {ROLE_PERMISSIONS[form.role] && (
                  <div className="role-info-panel">
                    <div className="role-info-panel__desc">{ROLE_PERMISSIONS[form.role].desc}</div>
                    <ul className="role-info-panel__perms">
                      {ROLE_PERMISSIONS[form.role].perms.map(p => (
                        <li key={p}><ion-icon name="checkmark-outline" /> {p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

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
