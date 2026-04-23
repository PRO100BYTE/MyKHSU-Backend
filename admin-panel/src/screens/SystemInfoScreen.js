import React, { useEffect, useState } from 'react'
import api from '../api'
import { BUILD_INFO_FALLBACK } from '../constants'
import { formatDateTimeKrasnoyarsk } from '../utils/datetime'

function formatDate(value) {
  return formatDateTimeKrasnoyarsk(value, '—')
}

export default function SystemInfoScreen() {
  const [meta, setMeta] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([api.getMeta(), api.getDashboardSummary()])
      .then(([metaResp, summaryResp]) => {
        if (cancelled) return
        setMeta(metaResp)
        setSummary(summaryResp?.ok ? summaryResp.data : null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="center-loader">
        <span className="spinner spinner-lg" />
      </div>
    )
  }

  const info = meta ?? BUILD_INFO_FALLBACK
  const freshness = summary?.roleSummary?.freshness
  const system = summary?.system

  return (
    <div className="screen-stack screen-stack--lg">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="information-circle-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Информация о системе</div>
          <div className="screen-hero__sub">Версии сервисов, сборка и оперативность разделов</div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">Системные сведения</div>
        </div>
        <div className="card__body info-list">
          <InfoRow label="Приложение" value={info.app_name ?? 'MyKHSU Backend'} />
          <InfoRow label="Версия API" value={info.api_version ?? '—'} />
          <InfoRow label="Версия приложения" value={info.app_version ?? '—'} />
          <InfoRow label="Версия Admin Panel" value={info.admin_panel_version ?? '—'} />
          <InfoRow label="Версия фронтенда" value={info.frontend_version ?? '—'} />
          <InfoRow label="Номер билда" value={info.build_number ?? '—'} />
          <InfoRow label="Git hash" value={info.git_commit_hash ?? '—'} />
          <InfoRow label="Дата билда" value={info.build_date_human || formatDate(info.build_date)} />
          <InfoRow label="Часовой пояс сборки" value={info.build_timezone_label || info.build_timezone || 'Asia/Krasnoyarsk (GMT+7)'} />
          <InfoRow label="База данных" value="SQLite (better-sqlite3)" />
          <InfoRow label="Аутентификация" value="JWT HS256 / Argon2id" />
        </div>
      </div>

      {system ? (
        <div className="card">
          <div className="card__header">
            <div className="card__title">Системная статистика</div>
          </div>
          <div className="card__body info-list">
            <InfoRow label="Серверный часовой пояс" value={system.timezone || 'Asia/Krasnoyarsk (GMT+7)'} />
            <InfoRow label="Сформировано" value={system.generatedAtHuman || formatDate(system.generatedAt)} />
            <InfoRow label="Node.js" value={system.runtime?.nodeVersion || '—'} />
            <InfoRow label="Платформа" value={system.runtime ? `${system.runtime.platform}/${system.runtime.arch}` : '—'} />
            <InfoRow label="PID" value={system.runtime?.pid ?? '—'} />
            <InfoRow label="Uptime (сек.)" value={system.runtime?.uptimeSeconds ?? '—'} />
            <InfoRow label="Память RSS (MB)" value={system.runtime?.memoryMb?.rss ?? '—'} />
            <InfoRow label="Heap Used (MB)" value={system.runtime?.memoryMb?.heapUsed ?? '—'} />
            <InfoRow label="Всего записей расписания" value={system.entities?.pairs ?? '—'} />
            <InfoRow label="Слоты звонков" value={system.entities?.times ?? '—'} />
            <InfoRow label="Новостей" value={system.entities?.news ?? '—'} />
            <InfoRow label="Пользователей" value={system.entities?.users ?? '—'} />
            <InfoRow label="Тикетов Единого окна" value={system.entities?.unifiedWindowTickets ?? '—'} />
            <InfoRow label="Сообщений Единого окна" value={system.entities?.unifiedWindowMessages ?? '—'} />
            <InfoRow label="Вложений Единого окна" value={system.entities?.unifiedWindowFiles ?? '—'} />
          </div>
        </div>
      ) : null}

      {freshness ? (
        <div className="card">
          <div className="card__header">
            <div className="card__title">Оперативность разделов</div>
          </div>
          <div className="card__body info-list">
            <InfoRow label="Последнее обновление расписания" value={freshness.scheduleLastUpdate || '—'} />
            <InfoRow label="Расписание заполнено до" value={formatDate(freshness.scheduleFilledToDate)} />
            <InfoRow label="Последняя публикация новости" value={formatDate(freshness.newsLastPublishedAt)} />
            <InfoRow label="Последняя активность Единого окна" value={formatDate(freshness.unifiedWindowLastActivityAt)} />
          </div>
        </div>
      ) : null}
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
