import React, { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useConfirmDialog } from '../context/ConfirmDialogContext';

export default function TimesScreen() {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // pending changes: { [id_or_new_key]: { ...fields, method: create|update|delete } }
  const [changes, setChanges] = useState({});
  const [newCounter, setNewCounter] = useState(0);
  const [history, setHistory] = useState([]);

  async function loadTimes() {
    const data = await api.getPairsTime();
    setTimes(Array.isArray(data) ? data : []);
    setLoading(false);
    setChanges({});
    setHistory([]);
  }

  useEffect(() => { loadTimes(); }, []);

  function handleChange(key, field, value) {
    setHistory(prev => [...prev.slice(-49), { changes, newCounter }]);
    setChanges(prev => {
      const item = prev[key] ?? times.find(t => t.id === key) ?? {};
      return { ...prev, [key]: { ...item, [field]: value, method: item.method === 'create' ? 'create' : 'update' } };
    });
  }

  async function handleDeleteRow(id) {
    const accepted = await confirm({
      title: 'Удаление строки',
      message: 'Убрать эту строку из изменений перед сохранением?',
      confirmText: 'Удалить',
      danger: true,
    });
    if (!accepted) return;

    setHistory(prev => [...prev.slice(-49), { changes, newCounter }]);
    setChanges(prev => ({ ...prev, [id]: { ...(times.find(t => t.id === id) ?? prev[id] ?? {}), method: 'delete' } }));
  }

  function handleAddRow() {
    setHistory(prev => [...prev.slice(-49), { changes, newCounter }]);
    const key = `new_${newCounter}`;
    setNewCounter(c => c + 1);
    setChanges(prev => ({ ...prev, [key]: { time: '', time_start: '', time_end: '', method: 'create' } }));
  }

  function handleUndoLastAction() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setChanges(previous.changes);
    setNewCounter(previous.newCounter);
    setHistory(prev => prev.slice(0, -1));
  }

  async function handleSave() {
    const items = Object.entries(changes).map(([key, val]) => {
      if (val.method === 'create') return { time: Number(val.time), time_start: val.time_start, time_end: val.time_end, method: 'create' };
      if (val.method === 'delete') return { id: key, method: 'delete' };
      return { id: key, time: Number(val.time), time_start: val.time_start, time_end: val.time_end, method: 'update' };
    });
    if (!items.length) return;

    const accepted = await confirm({
      title: 'Сохранение звонков',
      message: `Применить изменений: ${items.length}?`,
      confirmText: 'Сохранить',
    });
    if (!accepted) return;

    setSaving(true);
    const res = await api.updateTimes(items);
    setSaving(false);
    if (res?.ok) {
      showToast({ variant: 'success', title: 'Расписание звонков сохранено.' });
      setChanges({});
      setHistory([]);
      loadTimes();
    } else {
      showToast({
        variant: 'error',
        title: 'Не удалось сохранить расписание звонков.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-TMS-001',
      });
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
            {history.length > 0 && hasChanges && (
              <button className="btn btn-ghost btn-sm" onClick={handleUndoLastAction} disabled={saving}>
                <ion-icon name="arrow-undo-outline" />Отменить последнее
              </button>
            )}
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
