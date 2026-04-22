import React, { useEffect, useState } from 'react';
import api from '../api';
import { BUILD_INFO_FALLBACK } from '../constants';

export default function DashboardScreen() {
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getLastUpdate(),
      api.getCourses(),
      api.getWeekNumbers(),
      api.getNews(1, 0),
      api.getMeta(),
    ]).then(([lastUpdate, courses, weeks, news, metaInfo]) => {
      setStats({ lastUpdate, courses, weeks, news });
      setMeta(metaInfo);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const info = meta ?? BUILD_INFO_FALLBACK;
  const weekCount = stats?.weeks?.weeks?.length ?? 0;
  const courseCount = stats?.courses?.length ?? 0;
  const currentWeek = stats?.weeks?.current ?? '—';
  const lastUpdate = stats?.lastUpdate?.last_update ?? 'Никогда';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
        <div className="card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <QuickAction icon="cloud-upload-outline" label="Загрузить расписание" href="/admin-panel/schedule/upload" color="var(--accent)" />
          <QuickAction icon="pencil-outline" label="Управление новостями" href="/admin-panel/news" color="#3B82F6" />
          <QuickAction icon="alarm-outline" label="Расписание звонков" href="/admin-panel/times" color="#8B5CF6" />
          <QuickAction icon="people-outline" label="Пользователи админки" href="/admin-panel/users" color="#0EA5E9" />
          <QuickAction icon="trash-outline" label="Очистить расписание" danger href="/admin-panel/schedule/delete" />
        </div>
      </div>

      {/* Info */}
      <div className="card">
        <div className="card__header">
          <div className="card__title">О системе</div>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
      <div className={small ? undefined : "stat-card__value"} style={small ? { fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 } : undefined}>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0', borderBottom: '0.5px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
