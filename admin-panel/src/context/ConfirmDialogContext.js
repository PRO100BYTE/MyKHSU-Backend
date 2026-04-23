import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ConfirmDialogContext = createContext(null)

const DEFAULT_OPTIONS = {
  title: 'Подтвердите действие',
  message: 'Вы уверены, что хотите продолжить?',
  confirmText: 'Подтвердить',
  cancelText: 'Отмена',
  danger: false,
}

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const closeWithResult = useCallback((result) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setDialog(null)
    if (resolver) resolver(result)
  }, [])

  const confirm = useCallback((options = {}) => {
    const payload = { ...DEFAULT_OPTIONS, ...options }
    return new Promise(resolve => {
      resolverRef.current = resolve
      setDialog(payload)
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {dialog ? (
        <div className="modal-overlay" onClick={() => closeWithResult(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">{dialog.title}</h3>
            </div>
            <div className="modal__body">
              <p className="muted" style={{ margin: 0 }}>{dialog.message}</p>
            </div>
            <div className="modal__footer">
              <button className="btn" onClick={() => closeWithResult(false)}>{dialog.cancelText}</button>
              <button
                className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => closeWithResult(true)}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog() {
  return useContext(ConfirmDialogContext)
}
