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

export default function UnifiedWindowScreen() {
  const { showToast } = useToast()
  const [statusFilter, setStatusFilter] = useState('')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
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
    setTickets(Array.isArray(resp.data) ? resp.data : [])
  }

  useEffect(() => {
    fetchTickets()
  }, [statusFilter])

  useEffect(() => {
    if (!selected) return
    setForm({
      status: selected.status || 'open',
      responseText: '',
      comment: '',
    })
  }, [selected])

  const openTicket = async (ticketId) => {
    setSelectedLoading(true)
    const resp = await api.getUwTicket(ticketId)
    setSelectedLoading(false)

    if (!resp?.ok) {
      showRequestError('Не удалось открыть обращение.', resp)
      return
    }

    setSelected(resp.data)
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
    setForm(current => ({ ...current, responseText: '', comment: '' }))
    fetchTickets()
    showToast({ variant: 'success', title: 'Обращение успешно обновлено.' })
  }

  const latestMessage = selected?.messages?.[0]?.text || 'Сообщение отсутствует'

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
        </div>
      </div>

      {loading ? <div className="empty">Загрузка...</div> : null}

      {!loading && !tickets.length ? <div className="empty">Заявок нет</div> : null}

      {!loading && tickets.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Роль</th>
                <th>Тема</th>
                <th>Контакты</th>
                <th>Статус</th>
                <th>Создана</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.requester_role}</td>
                  <td>{t.subject}</td>
                  <td>{t.requester_name || '-'} / {t.requester_email || '-'}</td>
                  <td>{t.status}</td>
                  <td>{t.created_at}</td>
                  <td>
                    <button className="btn" onClick={() => openTicket(t.id)}>Открыть</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Заявка #{selected.id}</h3>
            </div>
            {selectedLoading ? <div className="modal__body">Загрузка данных обращения...</div> : null}
            <div className="form-grid" style={{ gap: 10 }}>
              <div className="field">
                <span className="field__label">Тема</span>
                <div className="input input--readonly">{selected.subject}</div>
              </div>
              <div className="field">
                <span className="field__label">Контактные данные</span>
                <div className="input input--readonly">
                  {selected.contact_name || 'Без имени'} / {selected.contact_email || 'Email не указан'}
                </div>
              </div>
              <div className="field">
                <span className="field__label">Сообщение</span>
                <div className="input input--readonly" style={{ minHeight: 100, whiteSpace: 'pre-wrap' }}>{latestMessage}</div>
              </div>
              <label className="field">
                <span className="field__label">Статус</span>
                <select className="select" value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}>
                  {STATUSES.slice(1).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Комментарий к смене статуса</span>
                <textarea className="input" rows={3} value={form.comment} onChange={e => setForm(v => ({ ...v, comment: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Ответ заявителю</span>
                <textarea className="input" rows={4} value={form.responseText} onChange={e => setForm(v => ({ ...v, responseText: e.target.value }))} />
              </label>
              {Array.isArray(selected.messages) && selected.messages.length > 0 ? (
                <div className="field">
                  <span className="field__label">Переписка</span>
                  <div className="table-wrap" style={{ maxHeight: 220 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Автор</th>
                          <th>Сообщение</th>
                          <th>Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.messages.map(message => (
                          <tr key={message.id}>
                            <td>{message.author_name || message.author_role}</td>
                            <td style={{ whiteSpace: 'pre-wrap' }}>{message.text || '—'}</td>
                            <td>{message.created_at}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal__footer">
              <button className="btn" onClick={() => setSelected(null)}>Закрыть</button>
              <button className="btn btn-primary" onClick={saveTicket} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
