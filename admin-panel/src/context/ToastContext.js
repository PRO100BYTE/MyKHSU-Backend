import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timeoutRefs = useRef(new Map())

  const dismissToast = useCallback((toastId) => {
    const timeoutId = timeoutRefs.current.get(toastId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutRefs.current.delete(toastId)
    }
    setToasts(current => current.filter(toast => toast.id !== toastId))
  }, [])

  const showToast = useCallback((toast) => {
    const id = toast.id ?? createToastId()
    const duration = toast.duration ?? (toast.variant === 'error' ? 7000 : 4000)
    const nextToast = {
      id,
      variant: toast.variant ?? 'info',
      title: toast.title ?? '',
      description: toast.description ?? '',
      code: toast.code ?? '',
      duration,
    }

    setToasts(current => [...current, nextToast])

    const timeoutId = window.setTimeout(() => {
      dismissToast(id)
    }, duration)
    timeoutRefs.current.set(id, timeoutId)

    return id
  }, [dismissToast])

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.variant}`} role="status">
            <div className="toast__icon" aria-hidden="true">
              <ion-icon
                name={
                  toast.variant === 'success'
                    ? 'checkmark-circle-outline'
                    : toast.variant === 'error'
                      ? 'alert-circle-outline'
                      : toast.variant === 'warning'
                        ? 'warning-outline'
                        : 'information-circle-outline'
                }
              />
            </div>
            <div className="toast__content">
              <div className="toast__title">{toast.title}</div>
              {toast.description ? <div className="toast__description">{toast.description}</div> : null}
              {toast.code ? <div className="toast__code">Код: {toast.code}</div> : null}
            </div>
            <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="Закрыть уведомление">
              <ion-icon name="close-outline" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}