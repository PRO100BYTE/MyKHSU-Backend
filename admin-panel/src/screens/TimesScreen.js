import React, { useEffect, useState } from 'react';
import api from '../api';

export default function TimesScreen() {
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  // pending changes: { [id_or_new_key]: { ...fields, method: create|update|delete } }
  const [changes, setChanges] = useState({});
  const [newCounter, setNewCounter] = useState(0);

  async function loadTimes() {
    const data = await api.getPairsTime();
    setTimes(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { loadTimes(); }, []);

  function showAlert(msg, ok = true) {
    setAlert({ msg, ok });
    setTimeout(() => setAlert(null), 3500);
  }

  function handleChange(key, field, value) {
    setChanges(prev => {
      const item = prev[key] ?? times.find(t => t.id === key) ?? {};
      return { ...prev, [key]: { ...item, [field]: value, method: item.method === 'create' ? 'create' : 'update' } };
    });
  }

  function handleDeleteRow(id) {
    setChanges(prev => ({ ...prev, [id]: { ...(times.find(t => t.id === id) ?? prev[id] ?? {}), method: 'delete' } }));
  }

  function handleAddRow() {
    const key = `new_${newCounter}`;
    setNewCounter(c => c + 1);
    setChanges(prev => ({ ...prev, [key]: { time: '', time_start: '', time_end: '', method: 'create' } }));
  }

  async function handleSave() {
    const items = Object.entries(changes).map(([key, val]) => {
      if (val.method === 'create') return { time: Number(val.time), time_start: val.time_start, time_end: val.time_end, method: 'create' };
      if (val.method === 'delete') return { id: key, method: 'delete' };
      return { id: key, time: Number(val.time), time_start: val.time_start, time_end: val.time_end, method: 'update' };
    });
    setSaving(true);
    const res = await api.updateTimes(items);
    setSaving(false);
    if (res?.ok) {
      showAlert('Сохранено!');
      setChanges({});
      loadTimes();
    } else {
      showAlert(res?.data?.error ?? 'Ошибка', false);
    }
  }

  // Merge times + new rows for display
  const displayRows = [
    ...times.map(t => {
      const ch = changes[t.id];
      if (ch?.method === 'delete') return null;
      return { key: t.id, ...t, ...(ch ?? {}) };
    }).filter(Boolean),
    ...Object.entries(changes)
      .filter(([k, v]) => k.startsWith('new_') && v.method === 'create')
      .map(([k, v]) => ({ key: k, ...v })),
  ];

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="screen-stack">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="alarm-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Расписание звонков</div>
          <div className="screen-hero__sub">Гибкое редактирование времени пар</div>
        </div>
      </div>

      {alert && (
        <div className={`alert ${alert.ok ? 'alert-success' : 'alert-error'}`}>
          <ion-icon name={alert.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} />
          {alert.msg}
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Расписание звонков</div>
            <div className="card__subtitle">Время начала и конца каждой пары</div>
          </div>
          <div className="table-actions-inline">
            <button className="btn btn-ghost btn-sm" onClick={handleAddRow}>
              <ion-icon name="add-outline" />Добавить
            </button>
            {hasChanges && (
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner spinner-sm" /> : <ion-icon name="save-outline" />}
                Сохранить
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="empty-state"><span className="spinner spinner-lg" /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="table-col-id">Пара №</th>
                  <th>Начало</th>
                  <th>Конец</th>
                  <th className="table-col-id">Удалить</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => (
                  <EditableRow
                    key={row.key}
                    row={row}
                    isNew={String(row.key).startsWith('new_')}
                    onChange={(field, val) => handleChange(row.key, field, val)}
                    onDelete={() => handleDeleteRow(row.key)}
                  />
                ))}
                {displayRows.length === 0 && (
                  <tr><td colSpan={4} className="table-empty">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EditableRow({ row, isNew, onChange, onDelete }) {
  return (
    <tr className={isNew ? 'row-new' : ''}>
      <td>
        <input
          type="number"
          className="form-input form-input--table form-input--small"
          value={row.time ?? ''}
          onChange={e => onChange('time', e.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-input form-input--table"
          placeholder="08:00"
          value={row.time_start ?? ''}
          onChange={e => onChange('time_start', e.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-input form-input--table"
          placeholder="09:30"
          value={row.time_end ?? ''}
          onChange={e => onChange('time_end', e.target.value)}
        />
      </td>
      <td>
        <button className="btn-icon btn-icon--danger" onClick={onDelete}>
          <ion-icon name="trash-outline" />
        </button>
      </td>
    </tr>
  );
}
