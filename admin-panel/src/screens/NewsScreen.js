import React, { useEffect, useState } from 'react';
import api from '../api';

export default function NewsScreen() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', item?: {...} }
  const [alert, setAlert] = useState(null);

  async function loadNews() {
    const data = await api.getNews(50, 0);
    setNews(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { loadNews(); }, []);

  function showAlert(msg, ok = true) {
    setAlert({ msg, ok });
    setTimeout(() => setAlert(null), 3500);
  }

  async function handleSave(content, id) {
    let res;
    if (id) res = await api.editNews(id, content);
    else res = await api.createNews(content);
    if (res?.ok) {
      showAlert(id ? 'Новость обновлена' : 'Новость создана');
      setModal(null);
      loadNews();
    } else {
      showAlert(res?.data?.error ?? 'Ошибка', false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Удалить эту новость?')) return;
    await api.deleteNews(id);
    showAlert('Новость удалена');
    loadNews();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <ion-icon name="add-circle-outline" />
          Создать новость
        </button>
      </div>

      {alert && (
        <div className={`alert ${alert.ok ? 'alert-success' : 'alert-error'}`}>
          <ion-icon name={alert.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} />
          {alert.msg}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state"><span className="spinner spinner-lg" /></div>
        ) : news.length === 0 ? (
          <div className="empty-state">
            <ion-icon name="newspaper-outline" />
            <div className="empty-state__title">Новостей нет</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Содержание</th>
                  <th>Дата</th>
                  <th>Изменено</th>
                  <th style={{ width: 90 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {news.map(n => (
                  <tr key={n.id}>
                    <td><span className="badge badge-gray">{n.id}</span></td>
                    <td style={{ maxWidth: 360 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {n.content}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>{n.date}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-tertiary)' }}>{n.last_change ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" title="Редактировать" onClick={() => setModal({ mode: 'edit', item: n })}>
                          <ion-icon name="pencil-outline" />
                        </button>
                        <button className="btn-icon" title="Удалить" onClick={() => handleDelete(n.id)} style={{ color: 'var(--danger)' }}>
                          <ion-icon name="trash-outline" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <NewsModal
          mode={modal.mode}
          item={modal.item}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function NewsModal({ mode, item, onSave, onClose }) {
  const [content, setContent] = useState(item?.content ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    await onSave(content.trim(), item?.id);
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <div className="modal__title">{mode === 'create' ? 'Создать новость' : 'Редактировать новость'}</div>
          <button className="btn-icon" onClick={onClose}><ion-icon name="close-outline" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">Содержание</label>
              <textarea
                className="form-textarea"
                rows={6}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Текст новости..."
                required
              />
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !content.trim()}>
              {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
