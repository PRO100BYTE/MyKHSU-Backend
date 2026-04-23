import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)
const TOAST_LEAVE_DURATION = 220

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const autoDismissTimeoutsRef = useRef(new Map())
  const removeTimeoutsRef = useRef(new Map())

  useEffect(() => {
    return () => {
      autoDismissTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId))
      removeTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId))
      autoDismissTimeoutsRef.current.clear()
      removeTimeoutsRef.current.clear()
    }
  }, [])

  const dismissToast = useCallback((toastId) => {
    const autoDismissTimeoutId = autoDismissTimeoutsRef.current.get(toastId)
    if (autoDismissTimeoutId) {
      clearTimeout(autoDismissTimeoutId)
      autoDismissTimeoutsRef.current.delete(toastId)
    }

    setToasts(current => {
      const target = current.find(toast => toast.id === toastId)
      if (!target || target.isLeaving) return current
      return current.map(toast => (toast.id === toastId ? { ...toast, isLeaving: true } : toast))
    })

    if (!removeTimeoutsRef.current.has(toastId)) {
      const removeTimeoutId = window.setTimeout(() => {
        removeTimeoutsRef.current.delete(toastId)
        setToasts(current => current.filter(toast => toast.id !== toastId))
      }, TOAST_LEAVE_DURATION)
      removeTimeoutsRef.current.set(toastId, removeTimeoutId)
    }
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
      isLeaving: false,
    }

    setToasts(current => [...current, nextToast])

    const timeoutId = window.setTimeout(() => {
      dismissToast(id)
    }, duration)
    autoDismissTimeoutsRef.current.set(id, timeoutId)

    return id
  }, [dismissToast])

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.variant}${toast.isLeaving ? ' toast--leaving' : ''}`} role="status">
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