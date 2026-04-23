import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'

const STATUSES = [
  { value: '', label: 'Все статусы' },
  { value: 'open', label: 'Открытые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'resolved', label: 'Решенные' },
  { value: 'closed', label: 'Закрытые' },
]

const STATUS_LABELS = {
  open: 'Открыто',
  in_progress: 'В работе',
  resolved: 'Решено',
  closed: 'Закрыто',
}

function formatDate(value) {
  if (!value) return 'Неизвестно'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

function getMessageAuthor(message) {
  if (message.author_role === 'user') return message.author_name || 'Пользователь'
  return message.author_name || 'Агент'
}

export default function UnifiedWindowScreen() {
  const { showToast } = useToast()
  const [statusFilter, setStatusFilter] = useState('')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ status: 'open', responseText: '', comment: '' })

  const showRequestError = (fallbackTitle, resp) => {
    showToast({
      variant: 'error',
      title: fallbackTitle,
      description: resp?.error || '',
      code: resp?.errorCode || 'UI-UW-001',
      duration: 8000,
    })
  }

  const fetchTickets = async () => {
    setLoading(true)
    const resp = await api.getUwTickets({ status: statusFilter || undefined, limit: 200 })
    setLoading(false)
    if (!resp?.ok) {
      showRequestError('Не удалось загрузить обращения Единого окна.', resp)
      return
    }
    const list = Array.isArray(resp.data) ? resp.data : []
    setTickets(list)
    if (!list.some(ticket => ticket.id === selectedId)) {
      setSelectedId(null)
      setSelected(null)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [statusFilter])

  const openTicket = async (ticketId) => {
    setSelectedId(ticketId)
    setSelectedLoading(true)
    const resp = await api.getUwTicket(ticketId)
    setSelectedLoading(false)

    if (!resp?.ok) {
      showRequestError('Не удалось открыть обращение.', resp)
      return
    }

    setSelected(resp.data)
    setForm({
      status: resp.data?.status || 'open',
      responseText: '',
      comment: '',
    })
  }

  const counts = useMemo(() => {
    return tickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    }, {})
  }, [tickets])

  const saveTicket = async () => {
    if (!selected) return

    if (!form.responseText.trim() && form.status === selected.status && !form.comment.trim()) {
      showToast({
        variant: 'warning',
        title: 'Нет изменений для сохранения.',
        code: 'UI-UW-002',
      })
      return
    }

    setSaving(true)

    if (form.responseText.trim()) {
      const messageResp = await api.postUwMessage(selected.id, form.responseText.trim())
      if (!messageResp?.ok) {
        setSaving(false)
        showRequestError('Не удалось отправить ответ по обращению.', messageResp)
        return
      }
    }

    if (form.status !== selected.status || form.comment.trim()) {
      const statusResp = await api.patchUwStatus(selected.id, form.status, form.comment.trim() || undefined)
      if (!statusResp?.ok) {
        setSaving(false)
        showRequestError('Не удалось обновить статус обращения.', statusResp)
        return
      }
    }

    const detailResp = await api.getUwTicket(selected.id)
    setSaving(false)

    if (!detailResp?.ok) {
      showRequestError('Обращение обновлено, но не удалось перечитать его состояние.', detailResp)
      setSelected(null)
      fetchTickets()
      return
    }

    setSelected(detailResp.data)
    setSelectedId(detailResp.data?.id ?? selected.id)
    setForm(current => ({ ...current, responseText: '', comment: '' }))
    fetchTickets()
    showToast({ variant: 'success', title: 'Обращение успешно обновлено.' })
  }

  const selectedTicketPreview = tickets.find(ticket => ticket.id === selectedId)

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Единое окно</h2>
        <p className="muted">Обращения посетителей, студентов и преподавателей</p>
      </div>

      <div className="panel__toolbar">
        <label className="field" style={{ maxWidth: 260 }}>
          <span className="field__label">Фильтр по статусу</span>
          <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>

        <div className="chip-row" style={{ marginLeft: 'auto' }}>
          <span className="chip">Открытые: {counts.open || 0}</span>
          <span className="chip">В работе: {counts.in_progress || 0}</span>
          <span className="chip">Решенные: {counts.resolved || 0}</span>
          <span className="chip">Закрытые: {counts.closed || 0}</span>
        </div>
      </div>

      {loading ? <div className="empty">Загрузка...</div> : null}

      {!loading && !tickets.length ? <div className="empty">Заявок нет</div> : null}

      {!loading && tickets.length ? (
        <div className="uw-admin-layout">
          <aside className="uw-admin-tickets">
            <div className="uw-admin-tickets__header">Список обращений</div>
            <div className="uw-admin-tickets__list">
              {tickets.map(ticket => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`uw-admin-ticket-card ${ticket.id === selectedId ? 'is-active' : ''}`}
                  onClick={() => openTicket(ticket.id)}
                >
                  <div className="uw-admin-ticket-card__row">
                    <strong>#{ticket.id}</strong>
                    <span className="badge badge-gray">{STATUS_LABELS[ticket.status] || ticket.status}</span>
                  </div>
                  <div className="uw-admin-ticket-card__subject">{ticket.subject || 'Без темы'}</div>
                  <div className="uw-admin-ticket-card__meta">{ticket.contact_name || 'Без имени'} • {ticket.contact_email || 'без email'}</div>
                  <div className="uw-admin-ticket-card__meta">{formatDate(ticket.updated_at || ticket.created_at)}</div>
                </button>
              ))}
            </div>
          </aside>

          <div className="uw-admin-chat">
            {!selectedId ? (
              <div className="empty">Выберите обращение из списка слева</div>
            ) : selectedLoading && !selected ? (
              <div className="empty">Загрузка диалога...</div>
            ) : selected ? (
              <>
                <div className="uw-admin-chat__header">
                  <div>
                    <h3>Обращение #{selected.id}</h3>
                    <p className="muted">{selected.subject || selectedTicketPreview?.subject || 'Без темы'}</p>
                    <p className="muted">{selected.contact_name || 'Без имени'} • {selected.contact_email || 'без email'} • {selected.category || 'other'}</p>
                  </div>
                  <div className="uw-admin-chat__controls">
                    <label className="field">
                      <span className="field__label">Статус</span>
                      <select className="select" value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}>
                        {STATUSES.slice(1).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field__label">Комментарий к статусу</span>
                      <input
                        className="input"
                        value={form.comment}
                        onChange={e => setForm(v => ({ ...v, comment: e.target.value }))}
                        placeholder="Причина изменения статуса"
                      />
                    </label>
                    <button className="btn btn-primary" onClick={saveTicket} disabled={saving}>
                      {saving ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                  </div>
                </div>

                <div className="uw-admin-chat__messages">
                  {Array.isArray(selected.messages) && selected.messages.length ? selected.messages.map(message => (
                    <div
                      key={message.id}
                      className={`uw-admin-message ${message.author_role === 'agent' ? 'is-agent' : 'is-user'}`}
                    >
                      <div className="uw-admin-message__meta">
                        <strong>{getMessageAuthor(message)}</strong>
                        <span>{formatDate(message.created_at)}</span>
                      </div>
                      <div className="uw-admin-message__body">{message.text || '—'}</div>
                    </div>
                  )) : (
                    <div className="empty">Переписка пока отсутствует</div>
                  )}
                </div>

                <div className="uw-admin-chat__composer">
                  <label className="field">
                    <span className="field__label">Ответ заявителю</span>
                    <textarea
                      className="input"
                      rows={3}
                      value={form.responseText}
                      onChange={e => setForm(v => ({ ...v, responseText: e.target.value }))}
                      placeholder="Введите ответ пользователю"
                    />
                  </label>
                </div>
              </>
            ) : (
              <div className="empty">Не удалось открыть обращение</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
