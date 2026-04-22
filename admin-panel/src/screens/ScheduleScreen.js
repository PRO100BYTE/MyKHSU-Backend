import React, { useState, useRef } from 'react';
import api from '../api';

export default function ScheduleScreen() {
          { id: 'manual', label: 'Ручной ввод', icon: 'create-outline' },
  const [tab, setTab] = useState('upload');

  return (
    <div className="screen-stack">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="calendar-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Расписание</div>
          <div className="screen-hero__sub">Импорт, обновление и очистка таблицы занятий</div>
        </div>
      </div>

      <div className="segmented">
        {[
          { id: 'upload', label: 'Загрузить', icon: 'cloud-upload-outline' },
          { id: 'delete', label: 'Очистить', icon: 'trash-outline' },
        ].map(t => (
          <button
            key={t.id}
            className={`segmented__item${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <ion-icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && <UploadTab />}
      {tab === 'manual' && <ManualTab />}
      {tab === 'delete' && <DeleteTab />}
    </div>
  );
}

function ManualTab() {
  const [course, setCourse] = useState('1');
  const [group, setGroup] = useState('');
  const [weekNumber, setWeekNumber] = useState('1');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState('day');
  const [weekday, setWeekday] = useState('Понедельник');
  const [catalogCourse, setCatalogCourse] = useState('');
  const [catalogGroupCourse, setCatalogGroupCourse] = useState('1');
  const [catalogGroupName, setCatalogGroupName] = useState('');
  const [lessons, setLessons] = useState([{ time: '', type: '', subject: '', teacher: '', auditory: '' }]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const updateLesson = (index, field, value) => {
    setLessons(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addLesson = () => {
    setLessons(prev => [...prev, { time: '', type: '', subject: '', teacher: '', auditory: '' }]);
  };

  const removeLesson = (index) => {
    setLessons(prev => prev.filter((_, i) => i !== index));
  };

  const createCatalogCourse = async () => {
    const num = Number.parseInt(catalogCourse, 10);
    if (Number.isNaN(num)) {
      alert('Введите номер курса');
      return;
    }
    const resp = await api.createCatalogCourse(num);
    if (!resp?.ok) {
      alert(resp?.data?.error || 'Не удалось добавить курс');
      return;
    }
    setCatalogCourse('');
    setNotice('Курс добавлен в каталог');
  };

  const createCatalogGroup = async () => {
    if (!catalogGroupName.trim()) {
      alert('Введите название группы');
      return;
    }
    const resp = await api.createCatalogGroup({ course: Number.parseInt(catalogGroupCourse, 10), group_name: catalogGroupName.trim() });
    if (!resp?.ok) {
      alert(resp?.data?.error || 'Не удалось добавить группу');
      return;
    }
    setCatalogGroupName('');
    setNotice('Группа добавлена в каталог');
  };

  const submitManual = async () => {
    if (!group.trim()) {
      alert('Укажите группу');
      return;
    }

    const cleaned = lessons
      .map((l) => ({ ...l, method: 'create' }))
      .filter((l) => l.time || l.subject || l.teacher || l.auditory || l.type);

    if (!cleaned.length) {
      alert('Добавьте хотя бы одну строку пары');
      return;
    }

    setLoading(true);
    const payload = {
      group: group.trim(),
      course: Number.parseInt(course, 10),
      date,
      week_number: Number.parseInt(weekNumber, 10),
      weekday,
      lessons: cleaned,
    };

    const resp = await api.updatePairs(payload);
    setLoading(false);
    if (!resp?.ok) {
      alert(resp?.data?.error || 'Не удалось сохранить расписание');
      return;
    }
    setNotice('Расписание сохранено');
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <div className="card__title">Ручное наполнение</div>
          <div className="card__subtitle">Курсы, группы и пары по дню или неделе</div>
        </div>
      </div>
      <div className="card__body" style={{ display: 'grid', gap: 14 }}>
        {notice ? (
          <div className="alert alert-success">
            <ion-icon name="checkmark-circle-outline" />
            {notice}
          </div>
        ) : null}

        <div className="table-wrap" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Добавить курс</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="input" placeholder="Номер курса" value={catalogCourse} onChange={e => setCatalogCourse(e.target.value)} />
            <button className="btn" onClick={createCatalogCourse}>Добавить курс</button>
          </div>

          <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>Добавить группу</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Курс" value={catalogGroupCourse} onChange={e => setCatalogGroupCourse(e.target.value)} style={{ maxWidth: 100 }} />
            <input className="input" placeholder="Название группы" value={catalogGroupName} onChange={e => setCatalogGroupName(e.target.value)} style={{ minWidth: 220 }} />
            <button className="btn" onClick={createCatalogGroup}>Добавить группу</button>
          </div>
        </div>

        <div className="table-wrap" style={{ padding: 12 }}>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))' }}>
            <input className="input" placeholder="Курс" value={course} onChange={e => setCourse(e.target.value)} />
            <input className="input" placeholder="Группа" value={group} onChange={e => setGroup(e.target.value)} />
            <input className="input" placeholder="Номер недели" value={weekNumber} onChange={e => setWeekNumber(e.target.value)} />
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <select className="select" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="day">По дню</option>
              <option value="week">По неделе</option>
            </select>
          </div>

          {mode === 'day' ? (
            <select className="select" style={{ marginTop: 10, maxWidth: 220 }} value={weekday} onChange={e => setWeekday(e.target.value)}>
              {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          ) : null}

          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Тип</th>
                  <th>Предмет</th>
                  <th>Преподаватель</th>
                  <th>Аудитория</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lessons.map((row, i) => (
                  <tr key={i}>
                    <td><input className="input" value={row.time} onChange={e => updateLesson(i, 'time', e.target.value)} placeholder="08:00-09:30" /></td>
                    <td><input className="input" value={row.type} onChange={e => updateLesson(i, 'type', e.target.value)} placeholder="лекция" /></td>
                    <td><input className="input" value={row.subject} onChange={e => updateLesson(i, 'subject', e.target.value)} placeholder="Математика" /></td>
                    <td><input className="input" value={row.teacher} onChange={e => updateLesson(i, 'teacher', e.target.value)} placeholder="Иванов И.И." /></td>
                    <td><input className="input" value={row.auditory} onChange={e => updateLesson(i, 'auditory', e.target.value)} placeholder="204" /></td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => removeLesson(i)} disabled={lessons.length === 1}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn" onClick={addLesson}>Добавить строку</button>
            <button className="btn btn-primary" onClick={submitManual} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить расписание'}
            </button>
          </div>
        </div>
      </div>
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
