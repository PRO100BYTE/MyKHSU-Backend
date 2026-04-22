import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

const STATUSES = [
  { value: '', label: 'Все статусы' },
  { value: 'new', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'resolved', label: 'Решённые' },
  { value: 'closed', label: 'Закрытые' },
]

export default function UnifiedWindowScreen() {
  const [statusFilter, setStatusFilter] = useState('')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ status: 'in_progress', assignee: '', response_text: '', internal_note: '' })

  const fetchTickets = async () => {
    setLoading(true)
    const resp = await api.getUnifiedWindowTickets({ status: statusFilter || undefined, limit: 200 })
    setLoading(false)
    if (!resp?.ok) {
      alert(resp?.data?.error || 'Не удалось загрузить заявки')
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
      status: selected.status || 'in_progress',
      assignee: selected.assignee || '',
      response_text: selected.response_text || '',
      internal_note: selected.internal_note || '',
    })
  }, [selected])

  const counts = useMemo(() => {
    return tickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    }, {})
  }, [tickets])

  const saveTicket = async () => {
    if (!selected) return
    const resp = await api.updateUnifiedWindowTicket(selected.id, form)
    if (!resp?.ok) {
      alert(resp?.data?.error || 'Не удалось обновить заявку')
      return
    }
    setSelected(null)
    fetchTickets()
  }

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
          <span className="chip">Новые: {counts.new || 0}</span>
          <span className="chip">В работе: {counts.in_progress || 0}</span>
          <span className="chip">Решённые: {counts.resolved || 0}</span>
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
                    <button className="btn" onClick={() => setSelected(t)}>Открыть</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modal__panel" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Заявка #{selected.id}</h3>
            </div>
            <div className="form-grid" style={{ gap: 10 }}>
              <div className="field">
                <span className="field__label">Тема</span>
                <div className="input input--readonly">{selected.subject}</div>
              </div>
              <div className="field">
                <span className="field__label">Сообщение</span>
                <div className="input input--readonly" style={{ minHeight: 100, whiteSpace: 'pre-wrap' }}>{selected.message}</div>
              </div>
              <label className="field">
                <span className="field__label">Статус</span>
                <select className="select" value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}>
                  {STATUSES.slice(1).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Исполнитель</span>
                <input className="input" value={form.assignee} onChange={e => setForm(v => ({ ...v, assignee: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Ответ заявителю</span>
                <textarea className="input" rows={3} value={form.response_text} onChange={e => setForm(v => ({ ...v, response_text: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">Внутренняя заметка</span>
                <textarea className="input" rows={3} value={form.internal_note} onChange={e => setForm(v => ({ ...v, internal_note: e.target.value }))} />
              </label>
            </div>
            <div className="modal__footer">
              <button className="btn" onClick={() => setSelected(null)}>Закрыть</button>
              <button className="btn btn--primary" onClick={saveTicket}>Сохранить</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
