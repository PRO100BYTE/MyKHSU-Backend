import { useEffect, useState } from 'react'

const DEFAULT_EXIT_MS = 220

export function useAnimatedVisibility(isOpen, exitMs = DEFAULT_EXIT_MS) {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    let timeoutId

    if (isOpen) {
      setIsRendered(true)
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
      timeoutId = window.setTimeout(() => setIsRendered(false), exitMs)
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [isOpen, exitMs])

  return { isRendered, isVisible }
}
