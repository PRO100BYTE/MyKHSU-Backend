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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleAddRow}>
              <ion-icon name="add-outline" />Добавить
            </button>
            {hasChanges && (
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <ion-icon name="save-outline" />}
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
                  <th style={{ width: 60 }}>Пара №</th>
                  <th>Начало</th>
                  <th>Конец</th>
                  <th style={{ width: 60 }}>Удалить</th>
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
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>Нет данных</td></tr>
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
    <tr style={isNew ? { background: 'var(--accent-glass)' } : undefined}>
      <td>
        <input
          type="number"
          className="form-input"
          style={{ width: 70, padding: '6px 10px' }}
          value={row.time ?? ''}
          onChange={e => onChange('time', e.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-input"
          style={{ width: 100, padding: '6px 10px' }}
          placeholder="08:00"
          value={row.time_start ?? ''}
          onChange={e => onChange('time_start', e.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-input"
          style={{ width: 100, padding: '6px 10px' }}
          placeholder="09:30"
          value={row.time_end ?? ''}
          onChange={e => onChange('time_end', e.target.value)}
        />
      </td>
      <td>
        <button className="btn-icon" onClick={onDelete} style={{ color: 'var(--danger)' }}>
          <ion-icon name="trash-outline" />
        </button>
      </td>
    </tr>
  );
}
