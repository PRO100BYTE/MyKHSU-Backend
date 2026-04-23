import React, { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function NewsScreen() {
  const { showToast } = useToast();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', item?: {...} }

  async function loadNews() {
    const data = await api.getNews(50, 0);
    setNews(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { loadNews(); }, []);

  async function handleSave(content, id) {
    let res;
    if (id) res = await api.editNews(id, content);
    else res = await api.createNews(content);
    if (res?.ok) {
      showToast({ variant: 'success', title: id ? 'Новость обновлена.' : 'Новость создана.' });
      setModal(null);
      loadNews();
    } else {
      showToast({
        variant: 'error',
        title: 'Не удалось сохранить новость.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-NWS-001',
      });
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Удалить эту новость?')) return;
    const res = await api.deleteNews(id);
    if (!res?.ok) {
      showToast({
        variant: 'error',
        title: 'Не удалось удалить новость.',
        description: res?.error || '',
        code: res?.errorCode || 'UI-NWS-002',
      });
      return;
    }
    showToast({ variant: 'success', title: 'Новость удалена.' });
    loadNews();
  }

  return (
    <div className="screen-stack">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="newspaper-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Новости</div>
          <div className="screen-hero__sub">Лента объявлений для пользователей приложения</div>
        </div>
      </div>

      <div className="top-actions">
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <ion-icon name="add-circle-outline" />
          Создать новость
        </button>
      </div>

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
                  <th className="table-col-id">ID</th>
                  <th>Содержание</th>
                  <th>Дата</th>
                  <th>Изменено</th>
                  <th className="table-col-actions">Действия</th>
                </tr>
              </thead>
              <tbody>
                {news.map(n => (
                  <tr key={n.id}>
                    <td><span className="badge badge-gray">{n.id}</span></td>
                    <td className="table-cell-truncate-wrap">
                      <div className="table-cell-truncate">
                        {n.content}
                      </div>
                    </td>
                    <td className="table-cell-muted">{n.date}</td>
                    <td className="table-cell-muted table-cell-muted--weak">{n.last_change ?? '—'}</td>
                    <td>
                      <div className="table-actions-inline">
                        <button className="btn-icon" title="Редактировать" onClick={() => setModal({ mode: 'edit', item: n })}>
                          <ion-icon name="pencil-outline" />
                        </button>
                        <button className="btn-icon btn-icon--danger" title="Удалить" onClick={() => handleDelete(n.id)}>
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
              {loading ? <span className="spinner spinner-sm" /> : null}
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
