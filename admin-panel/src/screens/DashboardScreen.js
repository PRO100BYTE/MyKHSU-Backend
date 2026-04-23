import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  admin: 'Администратор',
  manager: 'Менеджер',
  news_editor: 'Редактор новостей',
  schedule_dispatcher: 'Диспетчер расписания',
  unified_window_agent: 'Агент поддержки',
}

const STATUS_LABELS = {
  open: 'Открытые',
  in_progress: 'В работе',
  resolved: 'Решенные',
  closed: 'Закрытые',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

export default function DashboardScreen() {
  const { hasPermission } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const resp = await api.getDashboardSummary()
      if (!cancelled) {
        setSummary(resp?.ok ? resp.data : null)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const quickActions = useMemo(() => {
    return [
      { icon: 'cloud-upload-outline', label: 'Загрузить расписание', href: '/admin-panel/schedule/upload', color: 'var(--accent)', requiredPerms: ['schedule:write'] },
      { icon: 'pencil-outline', label: 'Управление новостями', href: '/admin-panel/news', color: '#3B82F6', requiredPerms: ['news:write'] },
      { icon: 'alarm-outline', label: 'Расписание звонков', href: '/admin-panel/times', color: '#8B5CF6', requiredPerms: ['times:write'] },
      { icon: 'people-outline', label: 'Пользователи админки', href: '/admin-panel/users', color: '#0EA5E9', requiredPerms: ['users:write'] },
      { icon: 'mail-open-outline', label: 'Обращения Единого окна', href: '/admin-panel/unified-window', color: '#16A34A', requiredPerms: ['unified_window:read', 'unified_window:write'] },
      { icon: 'trash-outline', label: 'Очистить расписание', danger: true, href: '/admin-panel/schedule/delete', requiredPerms: ['schedule:write'] },
    ].filter(action => action.requiredPerms.some(perm => hasPermission(perm)))
  }, [hasPermission])

  if (loading) {
    return (
      <div className="center-loader">
        <span className="spinner spinner-lg" />
      </div>
    )
  }

  if (!summary) {
    return <div className="empty">Не удалось загрузить сводку дашборда.</div>
  }

  const kind = summary.roleSummary?.kind
  const schedule = summary.roleSummary?.schedule
  const news = summary.roleSummary?.news
  const unifiedWindow = summary.roleSummary?.unifiedWindow
  const users = summary.roleSummary?.users
  const freshness = summary.roleSummary?.freshness

  return (
    <div className="screen-stack screen-stack--lg">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="grid-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Дашборд</div>
          <div className="screen-hero__sub">Ролевая сводка: {ROLE_LABELS[summary.role] || summary.role}</div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Быстрые действия</div>
            <div className="card__subtitle">Доступные операции по вашим правам</div>
          </div>
        </div>
        <div className="card__body actions-row">
          {quickActions.length ? quickActions.map(action => (
            <QuickAction
              key={action.href}
              icon={action.icon}
              label={action.label}
              href={action.href}
              color={action.color}
              danger={action.danger}
            />
          )) : (
            <div className="empty" style={{ width: '100%' }}>Нет доступных быстрых действий для вашей роли.</div>
          )}
        </div>
      </div>

      {(kind === 'unified_window_agent' || kind === 'manager' || kind === 'admin') && unifiedWindow ? (
        <div className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Единое окно</div>
              <div className="card__subtitle">Сводка по обращениям и реакции поддержки</div>
            </div>
          </div>
          <div className="card__body">
            <div className="stats-grid">
              <StatCard icon="mail-outline" value={unifiedWindow.total} label="Всего обращений" />
              <StatCard icon="chatbubbles-outline" value={unifiedWindow.unanswered} label="Неотвеченные" />
              <StatCard icon="notifications-outline" value={unifiedWindow.unreadForAgent} label="Непрочитанные для агента" />
            </div>
            <SimpleBars
              title="Статусы обращений"
              items={Object.entries(unifiedWindow.byStatus || {}).map(([key, value]) => ({
                label: STATUS_LABELS[key] || key,
                value,
              }))}
            />
          </div>
        </div>
      ) : null}

      {(kind === 'news_editor' || kind === 'manager' || kind === 'admin') && news ? (
        <div className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Новости</div>
              <div className="card__subtitle">Активность публикаций</div>
            </div>
          </div>
          <div className="card__body">
            <div className="stats-grid">
              <StatCard icon="newspaper-outline" value={news.total} label="Всего новостей" />
              <StatCard icon="sparkles-outline" value={news.publishedLast30Days} label="За 30 дней" />
              <StatCard icon="speedometer-outline" value={news.avgPerWeekLast8Weeks} label="В среднем в неделю" />
              <StatCard icon="time-outline" value={formatDate(news.lastPublishedAt)} label="Последняя публикация" small />
            </div>
          </div>
        </div>
      ) : null}

      {(kind === 'schedule_dispatcher' || kind === 'manager' || kind === 'admin') && schedule ? (
        <div className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Расписание</div>
              <div className="card__subtitle">Заполнение расписания и каталогов</div>
            </div>
          </div>
          <div className="card__body">
            <div className="stats-grid">
              <StatCard icon="calendar-outline" value={schedule.filledWeeks} label="Заполненных недель" />
              <StatCard icon="school-outline" value={schedule.courses} label="Добавленных курсов" />
              <StatCard icon="refresh-outline" value={schedule.lastScheduleUpdate || '—'} label="Последнее обновление" small />
              <StatCard icon="today-outline" value={formatDate(schedule.filledToDate)} label="Заполнено до даты" small />
            </div>
            <SimpleBars
              title="Группы по курсам"
              items={(schedule.groupsByCourse || []).map(item => ({
                label: `Курс ${item.course}`,
                value: item.count,
              }))}
            />
          </div>
        </div>
      ) : null}

      {kind === 'admin' && users ? (
        <div className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Администрирование</div>
              <div className="card__subtitle">Пользователи и оперативность наполнения разделов</div>
            </div>
          </div>
          <div className="card__body">
            <div className="stats-grid">
              <StatCard icon="people-outline" value={users.total} label="Пользователей всего" />
              <StatCard icon="checkmark-circle-outline" value={users.active} label="Активных" />
              <StatCard icon="pause-circle-outline" value={users.disabled} label="Отключенных" />
            </div>
            <SimpleBars
              title="Распределение пользователей по ролям"
              items={(users.byRole || []).map(item => ({
                label: ROLE_LABELS[item.role] || item.role,
                value: item.count,
              }))}
            />
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Последнее изменение</th>
                  </tr>
                </thead>
                <tbody>
                  {(users.recentChanges || []).map(item => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>{ROLE_LABELS[item.role] || item.role}</td>
                      <td>{item.is_active ? 'Активен' : 'Отключен'}</td>
                      <td>{formatDate(item.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {freshness ? (
              <div className="info-list" style={{ marginTop: 14 }}>
                <InfoRow label="Последнее обновление расписания" value={freshness.scheduleLastUpdate || '—'} />
                <InfoRow label="Расписание заполнено до" value={formatDate(freshness.scheduleFilledToDate)} />
                <InfoRow label="Последняя публикация новости" value={formatDate(freshness.newsLastPublishedAt)} />
                <InfoRow label="Последняя активность Единого окна" value={formatDate(freshness.unifiedWindowLastActivityAt)} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StatCard({ icon, value, label, small }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon">
        <ion-icon name={icon} />
      </div>
      <div className={small ? 'stat-card__value stat-card__value--small' : 'stat-card__value'}>
        {value}
      </div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

function QuickAction({ icon, label, href, color, danger }) {
  return (
    <a
      href={href}
      className={`btn ${danger ? 'btn-danger' : 'btn-ghost'}`}
      style={color && !danger ? { '--accent': color, '--accent-glass': `${color}22`, '--accent-glass-border': `${color}44` } : undefined}
    >
      <ion-icon name={icon} />
      {label}
    </a>
  )
}

function SimpleBars({ title, items }) {
  const max = Math.max(...items.map(item => Number(item.value || 0)), 1)
  return (
    <div className="dashboard-bars">
      <div className="dashboard-bars__title">{title}</div>
      {items.map(item => (
        <div key={item.label} className="dashboard-bars__row">
          <span className="dashboard-bars__label">{item.label}</span>
          <div className="dashboard-bars__track">
            <div className="dashboard-bars__fill" style={{ width: `${(Number(item.value || 0) / max) * 100}%` }} />
          </div>
          <span className="dashboard-bars__value">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  )
}