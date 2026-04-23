import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useConfirmDialog } from '../context/ConfirmDialogContext';

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const EMPTY_LESSON = {
  weekday: 'Понедельник',
  time: '',
  type: '',
  subject: '',
  teacher: '',
  auditory: '',
};

const WEEKDAY_NUMBERS = [1, 2, 3, 4, 5, 6]

function emptyPlannerCell() {
  return { id: null, type: '', subject: '', teacher: '', auditory: '' }
}

function normalizeCellValue(value) {
  return String(value ?? '').trim()
}

function plannerCellHasContent(cell) {
  return Boolean(
    normalizeCellValue(cell?.type) ||
    normalizeCellValue(cell?.subject) ||
    normalizeCellValue(cell?.teacher) ||
    normalizeCellValue(cell?.auditory)
  )
}

export default function ScheduleScreen() {
  const [tab, setTab] = useState('upload');

  return (
    <div className="screen-stack">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="calendar-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Расписание</div>
          <div className="screen-hero__sub">Импорт JSON, ручное редактирование по неделе, управление группами и очистка таблицы занятий</div>
        </div>
      </div>

      <div className="segmented">
        {[
          { id: 'upload', label: 'Загрузка', icon: 'cloud-upload-outline' },
          { id: 'manual', label: 'Ручное редактирование', icon: 'create-outline' },
          { id: 'groups', label: 'Управление группами', icon: 'people-outline' },
          { id: 'delete', label: 'Очистить', icon: 'trash-outline' },
        ].map(item => (
          <button
            key={item.id}
            className={`segmented__item${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <ion-icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'upload' ? <UploadTab /> : null}
      {tab === 'manual' ? <ManualTab /> : null}
      {tab === 'groups' ? <GroupsTab /> : null}
      {tab === 'delete' ? <DeleteTab /> : null}
    </div>
  );
}

function ManualTab() {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [course, setCourse] = useState('1');
  const [group, setGroup] = useState('');
  const [weekNumber, setWeekNumber] = useState('1');
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [cells, setCells] = useState({});
  const [initialCells, setInitialCells] = useState({});
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const coursesResp = await api.getCourses();
      const fetchedCourses = Array.isArray(coursesResp) ? coursesResp : [];
      if (!mounted) return;

      const normalized = fetchedCourses
        .map(item => parseInt(item, 10))
        .filter(item => !Number.isNaN(item))
        .sort((a, b) => a - b);

      setCourses(normalized);
      if (normalized.length && !normalized.includes(parseInt(course, 10))) {
        setCourse(String(normalized[0]));
      }
    })();
    return () => { mounted = false; };
  }, [course]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const selectedCourse = parseInt(course, 10);
      if (Number.isNaN(selectedCourse)) {
        setGroups([]);
        return;
      }

      const groupsResp = await api.getGroups(selectedCourse);
      const fetchedGroups = Array.isArray(groupsResp) ? groupsResp : [];
      if (!mounted) return;

      setGroups(fetchedGroups);
      if (fetchedGroups.length && !fetchedGroups.includes(group)) {
        setGroup(fetchedGroups[0]);
      }
    })();
    return () => { mounted = false; };
  }, [course, group]);

  const buildPlannerState = (slots, pairs) => {
    const nextCells = {}

    for (const slot of slots) {
      for (const weekday of WEEKDAY_NUMBERS) {
        nextCells[`${slot.id}-${weekday}`] = emptyPlannerCell()
      }
    }

    for (const pair of pairs) {
      const slotId = Number(pair.time)
      const weekday = Number(pair.weekday)
      if (!slotId || !WEEKDAY_NUMBERS.includes(weekday)) continue

      const key = `${slotId}-${weekday}`
      if (!(key in nextCells)) continue

      nextCells[key] = {
        id: pair.id,
        type: normalizeCellValue(pair.type),
        subject: normalizeCellValue(pair.subject),
        teacher: normalizeCellValue(pair.teacher),
        auditory: normalizeCellValue(pair.auditory),
      }
    }

    return nextCells
  }

  const loadWeekSchedule = async () => {
    const parsedCourse = parseInt(course, 10)
    const parsedWeek = parseInt(weekNumber, 10)
    if (!group.trim() || Number.isNaN(parsedCourse) || Number.isNaN(parsedWeek)) return

    setLoadingWeek(true)
    const [timesResp, pairsResp] = await Promise.all([
      api.getPairsTime(),
      api.getPairs({ group: group.trim(), course: parsedCourse, week_number: parsedWeek }),
    ])
    setLoadingWeek(false)

    const rawSlots = Array.isArray(timesResp) ? timesResp : []
    const rawPairs = pairsResp?.ok && Array.isArray(pairsResp.data) ? pairsResp.data : []

    if (!rawSlots.length) {
      showToast({
        variant: 'warning',
        title: 'Не найдены слоты звонков.',
        description: 'Сначала заполните раздел «Звонки», затем вернитесь к ручному редактированию.',
        code: 'UI-SCH-001',
      })
      setTimeSlots([])
      setCells({})
      setInitialCells({})
      return
    }

    const slots = rawSlots
      .map(slot => ({
        id: Number(slot.id),
        time: Number(slot.time),
        label: `${slot.time_start ?? '--:--'} - ${slot.time_end ?? '--:--'}`,
      }))
      .filter(slot => !Number.isNaN(slot.id))
      .sort((a, b) => {
        const left = Number.isNaN(a.time) ? Number.MAX_SAFE_INTEGER : a.time
        const right = Number.isNaN(b.time) ? Number.MAX_SAFE_INTEGER : b.time
        return left - right
      })

    const nextCells = buildPlannerState(slots, rawPairs)
    setTimeSlots(slots)
    setCells(nextCells)
    setInitialCells(JSON.parse(JSON.stringify(nextCells)))

    if (!rawPairs.length) {
      showToast({
        variant: 'info',
        title: 'Расписание на выбранную неделю не найдено.',
        description: 'Отображена пустая таблица для наполнения.',
      })
    }
  }

  useEffect(() => {
    loadWeekSchedule()
  }, [course, group, weekNumber])

  const updateCell = (slotId, weekday, field, value) => {
    const key = `${slotId}-${weekday}`
    setCells(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? emptyPlannerCell()),
        [field]: value,
      },
    }))
  }

  const submitManual = async () => {
    const parsedCourse = parseInt(course, 10)
    const parsedWeek = parseInt(weekNumber, 10)
    const safeGroup = group.trim()

    if (!safeGroup) {
      showToast({ variant: 'warning', title: 'Укажите группу.', code: 'UI-SCH-002' })
      return
    }
    if (Number.isNaN(parsedCourse)) {
      showToast({ variant: 'warning', title: 'Курс должен быть числом.', code: 'UI-SCH-003' })
      return
    }
    if (Number.isNaN(parsedWeek)) {
      showToast({ variant: 'warning', title: 'Номер недели должен быть числом.', code: 'UI-SCH-004' })
      return
    }
    if (!timeSlots.length) {
      showToast({ variant: 'warning', title: 'Нет слотов звонков для заполнения таблицы.', code: 'UI-SCH-005' })
      return
    }

    const requests = []

    for (const weekday of WEEKDAY_NUMBERS) {
      const lessons = []

      for (const slot of timeSlots) {
        const key = `${slot.id}-${weekday}`
        const current = cells[key] ?? emptyPlannerCell()
        const initial = initialCells[key] ?? emptyPlannerCell()

        const currentFilled = plannerCellHasContent(current)
        const initialFilled = plannerCellHasContent(initial)

        if (initial.id) {
          if (!currentFilled) {
            lessons.push({ id: initial.id, method: 'delete' })
            continue
          }

          const changed =
            normalizeCellValue(current.type) !== normalizeCellValue(initial.type) ||
            normalizeCellValue(current.subject) !== normalizeCellValue(initial.subject) ||
            normalizeCellValue(current.teacher) !== normalizeCellValue(initial.teacher) ||
            normalizeCellValue(current.auditory) !== normalizeCellValue(initial.auditory)

          if (changed) {
            lessons.push({
              id: initial.id,
              time: slot.id,
              type: normalizeCellValue(current.type) || null,
              subject: normalizeCellValue(current.subject) || null,
              teacher: normalizeCellValue(current.teacher) || null,
              auditory: normalizeCellValue(current.auditory) || null,
              method: 'update',
            })
          }
          continue
        }

        if (currentFilled && !initialFilled) {
          lessons.push({
            time: slot.id,
            type: normalizeCellValue(current.type) || null,
            subject: normalizeCellValue(current.subject) || null,
            teacher: normalizeCellValue(current.teacher) || null,
            auditory: normalizeCellValue(current.auditory) || null,
            method: 'create',
          })
        }
      }

      if (lessons.length) {
        requests.push({ weekday, lessons })
      }
    }

    if (!requests.length) {
      showToast({ variant: 'info', title: 'Изменений для сохранения нет.' })
      return
    }

    const accepted = await confirm({
      title: 'Сохранение расписания',
      message: `Сохранить изменения для группы ${safeGroup} на неделю ${parsedWeek}?`,
      confirmText: 'Сохранить',
    })
    if (!accepted) return

    setSaving(true)

    for (const chunk of requests) {
      const resp = await api.updatePairs({
        group: safeGroup,
        course: parsedCourse,
        week_number: parsedWeek,
        weekday: chunk.weekday,
        lessons: chunk.lessons,
      })

      if (!resp?.ok) {
        setSaving(false)
        showToast({
          variant: 'error',
          title: 'Не удалось сохранить расписание.',
          description: resp?.error || '',
          code: resp?.errorCode || 'UI-SCH-006',
        })
        return
      }
    }

    setSaving(false)
    showToast({ variant: 'success', title: 'Расписание сохранено.' })
    loadWeekSchedule()
  }

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <div className="card__title">Ручное редактирование</div>
          <div className="card__subtitle">Выберите курс, группу и неделю, затем заполните пары в табличном виде</div>
        </div>
      </div>
      <div className="card__body" style={{ display: 'grid', gap: 14 }}>
        <div className="table-wrap" style={{ padding: 12 }}>
          <div className="schedule-manual-filters">
            <label className="field schedule-manual-filter">
              <span className="field__label">Курс</span>
              <select className="select schedule-manual-filter__control" value={course} onChange={e => setCourse(e.target.value)}>
                {!courses.length ? <option value="">Нет курсов</option> : null}
                {courses.map(item => <option key={item} value={String(item)}>{item}</option>)}
              </select>
            </label>
            <label className="field schedule-manual-filter">
              <span className="field__label">Группа</span>
              <select className="select schedule-manual-filter__control" value={group} onChange={e => setGroup(e.target.value)}>
                {!groups.length ? <option value="">Нет групп</option> : null}
                {groups.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="field schedule-manual-filter">
              <span className="field__label">Номер недели</span>
              <input className="input schedule-manual-filter__control" placeholder="Например: 12" value={weekNumber} onChange={e => setWeekNumber(e.target.value)} />
            </label>
          </div>

          <label className="field" style={{ marginTop: 10 }}>
            <span className="field__label">Группа (ручной ввод)</span>
            <input className="input schedule-manual-filter__control" placeholder="Если группы нет в списке — введите вручную" value={group} onChange={e => setGroup(e.target.value)} />
          </label>

          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Время</th>
                  {WEEKDAYS.map(day => (
                    <th key={day} style={{ minWidth: 220 }}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(slot => (
                  <tr key={slot.id}>
                    <td>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>Пара {Number.isNaN(slot.time) ? '—' : slot.time}</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{slot.label}</span>
                      </div>
                    </td>
                    {WEEKDAY_NUMBERS.map(dayNumber => {
                      const key = `${slot.id}-${dayNumber}`
                      const cell = cells[key] ?? emptyPlannerCell()

                      return (
                        <td key={key}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <input
                              className="input"
                              value={cell.type}
                              onChange={e => updateCell(slot.id, dayNumber, 'type', e.target.value)}
                              placeholder="Тип"
                            />
                            <input
                              className="input"
                              value={cell.subject}
                              onChange={e => updateCell(slot.id, dayNumber, 'subject', e.target.value)}
                              placeholder="Предмет"
                            />
                            <input
                              className="input"
                              value={cell.teacher}
                              onChange={e => updateCell(slot.id, dayNumber, 'teacher', e.target.value)}
                              placeholder="Преподаватель"
                            />
                            <input
                              className="input"
                              value={cell.auditory}
                              onChange={e => updateCell(slot.id, dayNumber, 'auditory', e.target.value)}
                              placeholder="Аудитория"
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {!loadingWeek && !timeSlots.length ? (
                  <tr>
                    <td colSpan={7} className="table-empty">Нет слотов звонков. Заполните раздел «Звонки».</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn" onClick={loadWeekSchedule} disabled={loadingWeek || saving}>
              {loadingWeek ? 'Загрузка...' : 'Перезагрузить неделю'}
            </button>
            <button className="btn btn-primary" onClick={submitManual} disabled={saving || loadingWeek || !timeSlots.length}>
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupsTab() {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState('1');
  const [courseToCreate, setCourseToCreate] = useState('');
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCourses = async () => {
    const resp = await api.getCatalogCourses();
    const rows = resp?.ok && Array.isArray(resp.data) ? resp.data : [];
    const normalized = rows
      .map(item => parseInt(item.course, 10))
      .filter(item => !Number.isNaN(item))
      .sort((a, b) => a - b);

    setCourses(normalized);
    if (normalized.length && !normalized.includes(parseInt(course, 10))) {
      setCourse(String(normalized[0]));
    }
  };

  const loadGroups = async (courseValue = course) => {
    const parsedCourse = parseInt(courseValue, 10);
    if (Number.isNaN(parsedCourse)) {
      setGroups([]);
      return;
    }

    setLoading(true);
    const resp = await api.getCatalogGroups(parsedCourse);
    setLoading(false);
    if (!resp?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось загрузить группы.',
        description: resp?.error || '',
        code: resp?.errorCode || 'UI-SCH-006',
      });
      return;
    }
    setGroups(Array.isArray(resp.data) ? resp.data : []);
  };

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    loadGroups();
  }, [course]);

  const createCourse = async () => {
    const parsed = parseInt(courseToCreate, 10);
    if (Number.isNaN(parsed)) {
      showToast({ variant: 'warning', title: 'Введите номер курса.', code: 'UI-SCH-007' });
      return;
    }

    const resp = await api.createCatalogCourse(parsed);
    if (!resp?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось добавить курс.',
        description: resp?.error || '',
        code: resp?.errorCode || 'UI-SCH-008',
      });
      return;
    }

    setCourseToCreate('');
    await loadCourses();
    setCourse(String(parsed));
    showToast({
      variant: 'success',
      title: resp.data?.inserted ? 'Курс добавлен.' : 'Курс уже существует.',
    });
  };

  const createGroup = async () => {
    const parsedCourse = parseInt(course, 10);
    if (Number.isNaN(parsedCourse)) {
      showToast({ variant: 'warning', title: 'Выберите курс.', code: 'UI-SCH-009' });
      return;
    }
    if (!groupName.trim()) {
      showToast({ variant: 'warning', title: 'Введите название группы.', code: 'UI-SCH-010' });
      return;
    }

    const resp = await api.createCatalogGroup({
      course: parsedCourse,
      group_name: groupName.trim(),
    });
    if (!resp?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось добавить группу.',
        description: resp?.error || '',
        code: resp?.errorCode || 'UI-SCH-011',
      });
      return;
    }

    setGroupName('');
    await loadGroups(String(parsedCourse));
    showToast({
      variant: 'success',
      title: resp.data?.inserted ? 'Группа добавлена.' : 'Такая группа уже есть в выбранном курсе.',
    });
  };

  const saveGroup = async (id) => {
    if (!editingName.trim()) {
      showToast({ variant: 'warning', title: 'Введите название группы.', code: 'UI-SCH-012' });
      return;
    }

    const resp = await api.updateCatalogGroup(id, {
      course: parseInt(course, 10),
      group_name: editingName.trim(),
    });

    if (!resp?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось обновить группу.',
        description: resp?.error || '',
        code: resp?.errorCode || 'UI-SCH-013',
      });
      return;
    }

    setEditingId(null);
    setEditingName('');
    await loadGroups();
    showToast({ variant: 'success', title: 'Группа обновлена.' });
  };

  const deleteGroup = async (id, name) => {
    const accepted = await confirm({
      title: 'Удаление группы',
      message: `Удалить группу ${name}?`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!accepted) return;

    const resp = await api.deleteCatalogGroup(id);
    if (!resp?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось удалить группу.',
        description: resp?.error || '',
        code: resp?.errorCode || 'UI-SCH-014',
      });
      return;
    }

    await loadGroups();
    showToast({ variant: 'success', title: 'Группа удалена.' });
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <div className="card__title">Управление группами</div>
          <div className="card__subtitle">Создание, редактирование и удаление групп в выбранном курсе</div>
        </div>
      </div>

      <div className="card__body" style={{ display: 'grid', gap: 14 }}>
        <div className="table-wrap" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Добавить курс</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="input" placeholder="Номер курса" value={courseToCreate} onChange={e => setCourseToCreate(e.target.value)} />
            <button type="button" className="btn" onClick={createCourse}>Добавить курс</button>
          </div>
        </div>

        <div className="table-wrap" style={{ padding: 12 }}>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 4fr 2fr' }}>
            <select className="select" value={course} onChange={e => setCourse(e.target.value)}>
              {!courses.length ? <option value="">Нет курсов</option> : null}
              {courses.map(item => <option key={item} value={String(item)}>{item}</option>)}
            </select>
            <input className="input" placeholder="Новая группа" value={groupName} onChange={e => setGroupName(e.target.value)} />
            <button type="button" className="btn" onClick={createGroup}>Добавить группу</button>
          </div>

          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Курс</th>
                  <th>Группа</th>
                  <th style={{ width: 220 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(item => (
                  <tr key={item.id}>
                    <td>{item.course}</td>
                    <td>
                      {editingId === item.id ? (
                        <input className="input" value={editingName} onChange={e => setEditingName(e.target.value)} />
                      ) : item.group_name}
                    </td>
                    <td>
                      {editingId === item.id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn btn-sm" onClick={() => saveGroup(item.id)}>Сохранить</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditingName(''); }}>Отмена</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingName(item.group_name || '');
                            }}
                          >
                            Редактировать
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteGroup(item.id, item.group_name)}>
                            Удалить
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && groups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty">Для выбранного курса группы пока не добавлены</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditTab() {
  const { showToast } = useToast();
  const [course, setCourse] = useState('1');
  const [group, setGroup] = useState('');
  const [weekNumber, setWeekNumber] = useState('1');
  const [pairs, setPairs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const coursesResp = await api.getCourses();
      const fetchedCourses = Array.isArray(coursesResp) ? coursesResp : [];
      if (!mounted) return;

      const normalized = fetchedCourses
        .map(item => parseInt(item, 10))
        .filter(item => !Number.isNaN(item))
        .sort((a, b) => a - b);

      setCourses(normalized);
      if (normalized.length && !normalized.includes(parseInt(course, 10))) {
        setCourse(String(normalized[0]));
      }
    })();
    return () => { mounted = false; };
  }, [course]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const selectedCourse = parseInt(course, 10);
      if (Number.isNaN(selectedCourse)) {
        setGroups([]);
        return;
      }

      const groupsResp = await api.getGroups(selectedCourse);
      const fetchedGroups = Array.isArray(groupsResp) ? groupsResp : [];
      if (!mounted) return;

      setGroups(fetchedGroups);
      if (fetchedGroups.length && !fetchedGroups.includes(group)) {
        setGroup(fetchedGroups[0]);
      }
    })();
    return () => { mounted = false; };
  }, [course, group]);

  const loadPairs = async () => {
    if (!group) {
      showToast({ variant: 'warning', title: 'Выберите группу.', code: 'UI-SCH-010' });
      return;
    }
    setLoading(true);
    const resp = await api.getPairs({ group, course: parseInt(course, 10), week_number: parseInt(weekNumber, 10) });
    setLoading(false);
    if (Array.isArray(resp)) {
      setPairs(resp);
    } else {
      showToast({ variant: 'error', title: 'Не удалось загрузить пары.', code: 'UI-SCH-011' });
    }
  };

  const savePair = async (pairId) => {
    if (!editingData) return;
    setSaving(true);
    const resp = await api.updatePair(pairId, editingData);
    setSaving(false);
    if (resp?.ok) {
      setPairs(prev => prev.map(p => p.id === pairId ? { ...p, ...editingData } : p));
      setEditingId(null);
      setEditingData(null);
      showToast({ variant: 'success', title: 'Пара обновлена.' });
    } else {
      showToast({
        variant: 'error',
        title: 'Ошибка сохранения пары.',
        description: resp?.error || '',
        code: resp?.errorCode || 'UI-SCH-012',
      });
    }
  };

  const deletePair = async (pairId) => {
    const accepted = await confirm({
      title: 'Удаление пары',
      message: 'Вы уверены, что хотите удалить эту пару?',
      confirmText: 'Удалить',
      danger: true,
    });
    if (!accepted) return;
    setSaving(true);
    const resp = await api.deletePair(pairId);
    setSaving(false);
    if (resp?.ok) {
      setPairs(prev => prev.filter(p => p.id !== pairId));
      showToast({ variant: 'success', title: 'Пара удалена.' });
    } else {
      showToast({
        variant: 'error',
        title: 'Ошибка удаления пары.',
        description: resp?.error || '',
        code: resp?.errorCode || 'UI-SCH-013',
      });
    }
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <div className="card__title">Редактирование пар</div>
          <div className="card__subtitle">Редактирование, удаление существующих пар</div>
        </div>
      </div>
      <div className="card__body" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <select className="select" value={course} onChange={e => setCourse(e.target.value)}>
            {!courses.length ? <option value="">Нет курсов</option> : null}
            {courses.map(item => <option key={item} value={String(item)}>{item}</option>)}
          </select>
          <select className="select" value={group} onChange={e => setGroup(e.target.value)}>
            {!groups.length ? <option value="">Нет групп</option> : null}
            {groups.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input className="input" placeholder="Номер недели" value={weekNumber} onChange={e => setWeekNumber(e.target.value)} />
          <button className="btn btn-primary" onClick={loadPairs} disabled={loading || !group}>
            {loading ? 'Загрузка...' : 'Загрузить'}
          </button>
        </div>

        {pairs.length > 0 && (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>День</th>
                  <th>Время</th>
                  <th>Тип</th>
                  <th>Предмет</th>
                  <th>Преподаватель</th>
                  <th>Аудитория</th>
                  <th style={{ width: 140 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map(p => (
                  <tr key={p.id} style={{ opacity: editingId === p.id ? 0.7 : 1 }}>
                    <td>{WEEKDAYS[p.weekday - 1] || p.weekday}</td>
                    <td>
                      {editingId === p.id ? (
                        <input
                          className="input"
                          value={editingData?.time ?? p.time}
                          onChange={e => setEditingData(prev => ({ ...prev, time: e.target.value }))}
                          style={{ fontSize: 12 }}
                        />
                      ) : (
                        `${p.time_start} - ${p.time_end}`
                      )}
                    </td>
                    <td>
                      {editingId === p.id ? (
                        <input
                          className="input"
                          value={editingData?.type ?? p.type}
                          onChange={e => setEditingData(prev => ({ ...prev, type: e.target.value }))}
                          style={{ fontSize: 12 }}
                        />
                      ) : (
                        p.type
                      )}
                    </td>
                    <td>
                      {editingId === p.id ? (
                        <input
                          className="input"
                          value={editingData?.subject ?? p.subject}
                          onChange={e => setEditingData(prev => ({ ...prev, subject: e.target.value }))}
                          style={{ fontSize: 12 }}
                        />
                      ) : (
                        p.subject
                      )}
                    </td>
                    <td>
                      {editingId === p.id ? (
                        <input
                          className="input"
                          value={editingData?.teacher ?? p.teacher}
                          onChange={e => setEditingData(prev => ({ ...prev, teacher: e.target.value }))}
                          style={{ fontSize: 12 }}
                        />
                      ) : (
                        p.teacher
                      )}
                    </td>
                    <td>
                      {editingId === p.id ? (
                        <input
                          className="input"
                          value={editingData?.auditory ?? p.auditory}
                          onChange={e => setEditingData(prev => ({ ...prev, auditory: e.target.value }))}
                          style={{ fontSize: 12 }}
                        />
                      ) : (
                        p.auditory
                      )}
                    </td>
                    <td>
                      {editingId === p.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm" onClick={() => savePair(p.id)} disabled={saving}>
                            Сохр.
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditingData(null); }}>
                            Отм.
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditingId(p.id);
                              setEditingData(p);
                            }}
                          >
                            Ред.
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#ef4444' }}
                            onClick={() => deletePair(p.id)}
                          >
                            Удал.
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadTab() {
  const { showToast } = useToast();
  const [file, setFile] = useState(null);
  const [replace, setReplace] = useState(true);
  const [loading, setLoading] = useState(false);
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
    const res = await api.uploadSchedule(file, replace);
    setLoading(false);
    if (res?.ok) {
      showToast({ variant: 'success', title: `Успешно: добавлено строк ${res.data.inserted ?? '?'}.` });
      setFile(null);
    } else {
      showToast({
        variant: 'error',
        title: 'Ошибка загрузки расписания.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-SCH-014',
      });
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <div className="card__title">Загрузка расписания</div>
          <div className="card__subtitle">JSON-файл в формате ХГУ</div>
        </div>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const accepted = await confirm({
      title: 'Очистка расписания',
      message: 'Удалить все записи из таблицы pairs? Действие необратимо.',
      confirmText: 'Очистить',
      danger: true,
    });
    if (!accepted) return;

    setLoading(true);
    const res = await api.deletePairsTable();
    setLoading(false);
    if (!res?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось очистить расписание.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-SCH-015',
      });
      return;
    }
    showToast({ variant: 'success', title: 'Расписание успешно очищено.' });
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
        <div className="alert alert-warning">
          <ion-icon name="warning-outline" />
          Это действие нельзя отменить. Все пары будут удалены безвозвратно.
        </div>

        <button className="btn btn-danger" onClick={handleDelete} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <ion-icon name="trash-outline" />}
          Очистить расписание
        </button>
      </div>
    </div>
  );
}
