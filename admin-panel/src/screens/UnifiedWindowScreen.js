import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'
import { useConfirmDialog } from '../context/ConfirmDialogContext'
import { formatDateTimeKrasnoyarsk } from '../utils/datetime'
import { useAnimatedVisibility } from '../hooks/useAnimatedVisibility'
import { findProfanity } from '../utils/profanityDictionary'

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

const ROLE_LABELS = {
  visitor: 'Посетитель',
  student: 'Студент',
  teacher: 'Преподаватель',
}

const LAST_AUTHOR_LABELS = {
  user: 'Пользователь',
  agent: 'Администрация',
}

function formatDate(value) {
  return formatDateTimeKrasnoyarsk(value, 'Неизвестно')
}

function getMessageAuthor(message) {
  if (message.author_role === 'user') return message.author_name || 'Пользователь'
  return message.author_name || 'Агент'
}

export default function UnifiedWindowScreen() {
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()
  const [statusFilter, setStatusFilter] = useState('')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ responseText: '' })
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusForm, setStatusForm] = useState({ status: 'open', comment: '' })
  const statusModalVisibility = useAnimatedVisibility(statusModalOpen)

  const showRequestError = (fallbackTitle, resp) => {
    showToast({
      variant: 'error',
      title: fallbackTitle,
      description: resp?.error || '',
      code: resp?.errorCode || 'UI-UW-001',
      duration: 8000,
    })
  }

  const fetchTickets = async (preserveSelectedId = selectedId) => {
    setLoading(true)
    const resp = await api.getUwTickets({ status: statusFilter || undefined, limit: 200 })
    setLoading(false)
    if (!resp?.ok) {
      showRequestError('Не удалось загрузить обращения Единого окна.', resp)
      return
    }
    const list = Array.isArray(resp.data) ? resp.data : []
    setTickets(list)
    if (!list.some(ticket => ticket.id === preserveSelectedId)) {
      setSelectedId(null)
      setSelected(null)
    }
  }

  useEffect(() => {
    fetchTickets(selectedId)
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
      responseText: '',
    })
    setStatusForm({
      status: resp.data?.status || 'open',
      comment: '',
    })
    fetchTickets(ticketId)
  }

  const counts = useMemo(() => {
    return tickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    }, {})
  }, [tickets])

  const refreshSelected = async (ticketId) => {
    const detailResp = await api.getUwTicket(ticketId)
    if (!detailResp?.ok) {
      showRequestError('Не удалось перечитать состояние обращения.', detailResp)
      return false
    }

    setSelected(detailResp.data)
    setSelectedId(detailResp.data?.id ?? ticketId)
    setStatusForm({ status: detailResp.data?.status || 'open', comment: '' })
    return true
  }

  const sendMessage = async () => {
    if (!selected) return

    const safeResponse = form.responseText.trim()

    if (!safeResponse) {
      showToast({
        variant: 'warning',
        title: 'Введите текст сообщения перед отправкой.',
        code: 'UI-UW-002',
      })
      return
    }

    if (findProfanity(safeResponse).hasProfanity) {
      showToast({
        variant: 'error',
        title: 'Обнаружены недопустимые выражения в сообщении.',
        description: 'Отредактируйте сообщение и используйте более корректные выражения.',
        code: 'UI-UW-010',
      })
      return
    }

    setSaving(true)

    const messageResp = await api.postUwMessage(selected.id, safeResponse)
    if (!messageResp?.ok) {
      setSaving(false)
      showRequestError('Не удалось отправить ответ по обращению.', messageResp)
      return
    }

    const refreshed = await refreshSelected(selected.id)
    setSaving(false)
    if (!refreshed) return

    setForm({ responseText: '' })
    fetchTickets(selected.id)
    showToast({ variant: 'success', title: 'Ответ отправлен.' })
  }

  const applyStatusChange = async () => {
    if (!selected) return

    if (statusForm.status === selected.status && !statusForm.comment.trim()) {
      showToast({ variant: 'warning', title: 'Нет изменений статуса.' })
      return
    }

    setSaving(true)
    const statusResp = await api.patchUwStatus(selected.id, statusForm.status, statusForm.comment.trim() || undefined)
    if (!statusResp?.ok) {
      setSaving(false)
      showRequestError('Не удалось обновить статус обращения.', statusResp)
      return
    }

    const refreshed = await refreshSelected(selected.id)
    setSaving(false)
    if (!refreshed) return

    setStatusModalOpen(false)
    fetchTickets()
    showToast({ variant: 'success', title: 'Статус обращения обновлен.' })
  }

  const deleteTicket = async () => {
    if (!selected) return
    const confirmed = await confirm({
      title: 'Удаление обращения',
      message: `Удалить обращение #${selected.id}? Действие необратимо.`,
      confirmText: 'Удалить',
      danger: true,
    })
    if (!confirmed) return

    setSaving(true)
    const resp = await api.deleteUwTicket(selected.id)
    setSaving(false)

    if (!resp?.ok) {
      showRequestError('Не удалось удалить обращение.', resp)
      return
    }

    setSelected(null)
    setSelectedId(null)
    fetchTickets()
    showToast({ variant: 'success', title: 'Обращение удалено.' })
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
                    <div className="uw-admin-ticket-card__badges">
                      {ticket.has_unread_for_agent ? <span className="badge badge-red">Непрочитано</span> : null}
                      <span className="badge badge-gray">{STATUS_LABELS[ticket.status] || ticket.status}</span>
                    </div>
                  </div>
                  <div className="uw-admin-ticket-card__subject">{ticket.subject || 'Без темы'}</div>
                  <div className="uw-admin-ticket-card__meta">{ticket.contact_name || 'Без имени'} • {ROLE_LABELS[ticket.requester_role] || 'Пользователь'}</div>
                  <div className="uw-admin-ticket-card__meta">{ticket.contact_email || 'без email'}</div>
                  <div className="uw-admin-ticket-card__meta">Последнее сообщение: {LAST_AUTHOR_LABELS[ticket.last_message_author_role] || '—'}</div>
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
                    <p className="muted">
                      {selected.contact_name || 'Без имени'} • {selected.contact_email || 'без email'} • {ROLE_LABELS[selected.requester_role] || 'Пользователь'}
                    </p>
                  </div>
                  <div className="uw-admin-chat__controls">
                    <button type="button" className="btn" onClick={() => setStatusModalOpen(true)} disabled={saving}>
                      Изменить статус
                    </button>
                    <button type="button" className="btn btn-danger" onClick={deleteTicket} disabled={saving}>
                      Удалить
                    </button>
                  </div>
                </div>

                {statusModalVisibility.isRendered ? (
                  <div className={`modal-overlay${statusModalVisibility.isVisible ? ' modal-overlay--open' : ''}`} onClick={() => setStatusModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                      <div className="modal__header">
                        <h3 className="modal__title">Изменение статуса</h3>
                      </div>
                      <div className="modal__body">
                        <label className="field">
                          <span className="field__label">Статус</span>
                          <select className="select" value={statusForm.status} onChange={e => setStatusForm(v => ({ ...v, status: e.target.value }))}>
                            {STATUSES.slice(1).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field__label">Комментарий к смене статуса</span>
                          <textarea
                            className="input"
                            rows={3}
                            value={statusForm.comment}
                            onChange={e => setStatusForm(v => ({ ...v, comment: e.target.value }))}
                            placeholder="Причина изменения статуса"
                          />
                        </label>
                      </div>
                      <div className="modal__footer">
                        <button type="button" className="btn" onClick={() => setStatusModalOpen(false)}>Отмена</button>
                        <button type="button" className="btn btn-primary" onClick={applyStatusChange} disabled={saving}>
                          {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

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
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      placeholder="Введите ответ пользователю"
                    />
                  </label>
                  <div className="uw-admin-chat__composer-actions">
                    <button type="button" className="btn btn-primary" onClick={sendMessage} disabled={saving || !form.responseText.trim()}>
                      {saving ? 'Отправка...' : 'Отправить сообщение'}
                    </button>
                  </div>
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
