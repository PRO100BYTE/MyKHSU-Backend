import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAnimatedVisibility } from '../hooks/useAnimatedVisibility'

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
  const [renderedDialog, setRenderedDialog] = useState(null)
  const resolverRef = useRef(null)
  const visibility = useAnimatedVisibility(Boolean(dialog))

  useEffect(() => {
    if (dialog) {
      setRenderedDialog(dialog)
      return
    }

    if (!visibility.isRendered) {
      setRenderedDialog(null)
    }
  }, [dialog, visibility.isRendered])

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
      {visibility.isRendered && renderedDialog ? (
        <div className={`modal-overlay${visibility.isVisible ? ' modal-overlay--open' : ''}`} onClick={() => closeWithResult(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">{renderedDialog.title}</h3>
            </div>
            <div className="modal__body">
              <p className="muted" style={{ margin: 0 }}>{renderedDialog.message}</p>
            </div>
            <div className="modal__footer">
              <button className="btn" onClick={() => closeWithResult(false)}>{renderedDialog.cancelText}</button>
              <button
                className={`btn ${renderedDialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => closeWithResult(true)}
              >
                {renderedDialog.confirmText}
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
