import React, { useState, useRef } from 'react';
import api from '../api';

export default function ScheduleScreen() {
  const [tab, setTab] = useState('upload');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'upload', label: 'Загрузить', icon: 'cloud-upload-outline' },
          { id: 'delete', label: 'Очистить', icon: 'trash-outline' },
        ].map(t => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.id)}
          >
            <ion-icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && <UploadTab />}
      {tab === 'delete' && <DeleteTab />}
    </div>
  );
}

function UploadTab() {
  const [file, setFile] = useState(null);
  const [replace, setReplace] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/json' || f?.name.endsWith('.json')) setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const res = await api.uploadSchedule(file, replace);
    setLoading(false);
    if (res?.ok) {
      setResult({ ok: true, msg: `Успешно! Добавлено строк: ${res.data.inserted ?? '?'}` });
      setFile(null);
    } else {
      setResult({ ok: false, msg: res?.data?.error ?? 'Ошибка загрузки' });
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <div className="card__title">Загрузка расписания</div>
          <div className="card__subtitle">JSON-файл в формате ХГСУ</div>
        </div>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {result && (
          <div className={`alert ${result.ok ? 'alert-success' : 'alert-error'}`}>
            <ion-icon name={result.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} />
            {result.msg}
          </div>
        )}

        {/* Upload zone */}
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <ion-icon name={file ? 'document-text-outline' : 'cloud-upload-outline'} />
          <div className="upload-zone__text">
            {file ? file.name : 'Нажмите или перетащите JSON-файл'}
          </div>
          <div className="upload-zone__hint">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Поддерживается только формат .json'}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0] ?? null)}
          />
        </div>

        {/* Mode */}
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="radio" checked={replace} onChange={() => setReplace(true)} />
            <span><strong>Заменить</strong> (удалить старое расписание)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="radio" checked={!replace} onChange={() => setReplace(false)} />
            <span><strong>Дополнить</strong> (добавить к существующему)</span>
          </label>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!file || loading}
          style={{ alignSelf: 'flex-start' }}
        >
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <ion-icon name="cloud-upload-outline" />}
          {loading ? 'Загрузка...' : 'Загрузить расписание'}
        </button>
      </div>
    </div>
  );
}

function DeleteTab() {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await api.deletePairsTable();
    setLoading(false);
    setDone(true);
    setConfirm(false);
  }

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <div className="card__title">Очистка расписания</div>
          <div className="card__subtitle" style={{ color: 'var(--danger)' }}>
            Внимание: удалятся все записи из таблицы pairs
          </div>
        </div>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {done && (
          <div className="alert alert-success">
            <ion-icon name="checkmark-circle-outline" />
            Расписание успешно очищено.
          </div>
        )}
        <div className="alert alert-warning">
          <ion-icon name="warning-outline" />
          Это действие нельзя отменить. Все пары будут удалены безвозвратно.
        </div>

        {!confirm ? (
          <button className="btn btn-danger" onClick={() => setConfirm(true)} style={{ alignSelf: 'flex-start' }}>
            <ion-icon name="trash-outline" />
            Очистить расписание
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Вы уверены? Все данные расписания будут удалены.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <ion-icon name="trash-outline" />}
                Да, удалить
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
