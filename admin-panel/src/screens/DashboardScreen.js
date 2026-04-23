import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { BUILD_INFO_FALLBACK } from '../constants';

export default function DashboardScreen() {
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const canReadUnifiedWindow = hasPermission('unified_window:read');

    Promise.all([
      api.getLastUpdate(),
      api.getCourses(),
      api.getWeekNumbers(),
      api.getNews(1, 0),
      api.getMeta(),
      canReadUnifiedWindow ? api.getUwTickets({ limit: 5, status: 'open' }) : Promise.resolve(null),
    ]).then(([lastUpdate, courses, weeks, news, metaInfo, uwTickets]) => {
      setStats({ lastUpdate, courses, weeks, news });
      setMeta(metaInfo);
      setTickets(Array.isArray(uwTickets?.data) ? uwTickets.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [hasPermission]);

  if (loading) {
    return (
      <div className="center-loader">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const info = meta ?? BUILD_INFO_FALLBACK;
  const weekCount = stats?.weeks?.weeks?.length ?? 0;
  const courseCount = stats?.courses?.length ?? 0;
  const currentWeek = stats?.weeks?.current ?? '—';
  const lastUpdate = stats?.lastUpdate?.last_update ?? 'Никогда';
  const quickActions = [
    { icon: 'cloud-upload-outline', label: 'Загрузить расписание', href: '/admin-panel/schedule/upload', color: 'var(--accent)', requiredPerms: ['schedule:write'] },
    { icon: 'pencil-outline', label: 'Управление новостями', href: '/admin-panel/news', color: '#3B82F6', requiredPerms: ['news:write'] },
    { icon: 'alarm-outline', label: 'Расписание звонков', href: '/admin-panel/times', color: '#8B5CF6', requiredPerms: ['times:write'] },
    { icon: 'people-outline', label: 'Пользователи админки', href: '/admin-panel/users', color: '#0EA5E9', requiredPerms: ['users:write'] },
    { icon: 'mail-open-outline', label: 'Обращения Единого окна', href: '/admin-panel/unified-window', color: '#16A34A', requiredPerms: ['unified_window:read', 'unified_window:write'] },
    { icon: 'trash-outline', label: 'Очистить расписание', danger: true, href: '/admin-panel/schedule/delete', requiredPerms: ['schedule:write'] },
  ].filter(action => action.requiredPerms.some(perm => hasPermission(perm)));

  return (
    <div className="screen-stack screen-stack--lg">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="grid-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Дашборд</div>
          <div className="screen-hero__sub">Оперативная сводка и быстрые действия</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon="calendar-outline" value={weekCount} label="Недель в расписании" />
        <StatCard icon="school-outline" value={courseCount} label="Курсов" />
        <StatCard icon="time-outline" value={currentWeek} label="Текущая неделя" />
        <StatCard icon="refresh-outline" value={lastUpdate} label="Последнее обновление" small />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Быстрые действия</div>
            <div className="card__subtitle">Часто используемые операции</div>
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
            <div className="empty" style={{ width: '100%' }}>
              Нет доступных быстрых действий для вашей роли.
            </div>
          )}
        </div>
      </div>

      {/* Unified Window Tickets */}
      {tickets.length > 0 && (
        <div className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Обращения Единого окна</div>
              <div className="card__subtitle">Последние открытые обращения</div>
            </div>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tickets.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                  background: 'var(--surface-secondary)', borderRadius: 8, fontSize: 13
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', 
                    background: t.priority === 'urgent' ? '#ef4444' : t.priority === 'high' ? '#f59e0b' : '#10b981'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{t.subject}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {t.contact_name} • {new Date(t.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                    background: 'var(--accent-glass)', color: 'var(--accent)'
                  }}>
                    {t.status === 'open' ? 'Открыто' : t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card">
        <div className="card__header">
          <div className="card__title">О системе</div>
        </div>
        <div className="card__body info-list">
          <InfoRow label="Версия API" value={`${info.api_version ?? '—'} (Node.js)`} />
          <InfoRow label="Версия приложения" value={info.app_version ?? '—'} />
          <InfoRow label="Номер билда" value={info.build_number ?? '—'} />
          <InfoRow label="Дата билда" value={info.build_date ? new Date(info.build_date).toLocaleString('ru-RU') : '—'} />
          <InfoRow label="База данных" value="SQLite (better-sqlite3)" />
          <InfoRow label="Аутентификация" value="JWT HS256 / Argon2id" />
        </div>
      </div>
    </div>
  );
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
  );
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
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}
