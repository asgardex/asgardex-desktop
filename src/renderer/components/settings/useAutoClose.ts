import { useEffect, useRef } from 'react'

/**
 * Calls `onClose` once, `ms` after mount. The latest `onClose` is used (a new function identity on re-render does not
 * restart the timer).
 */
export const useAutoClose = (onClose: () => void, ms: number): void => {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    const timer = setTimeout(() => ref.current(), ms)
    return () => clearTimeout(timer)
  }, [ms])
}
