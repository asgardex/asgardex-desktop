import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import clsx from 'clsx'

interface SwitchProps {
  /** Labels for the two options */
  labels?: [string, string]
  /** Colors for the two options */
  colors?: [string, string]
  /** Callback when switching */
  onChange?: (active: string) => void
}

export function Switch({ labels = ['A', 'B'], colors = ['#3B82F6', '#EF4444'], onChange }: SwitchProps) {
  const [active, setActive] = useState(labels[0])
  const activeIndex = active === labels[0] ? 0 : 1
  const containerRef = useRef<HTMLDivElement>(null)
  const [halfWidth, setHalfWidth] = useState(0)
  const labelA = labels[0]
  const labelB = labels[1]

  useLayoutEffect(() => {
    if (containerRef.current) {
      setHalfWidth(containerRef.current.offsetWidth / 2)
    }
  }, [labelA, labelB])

  const handleToggle = useCallback(() => {
    const next = active === labels[0] ? labels[1] : labels[0]
    setActive(next)
    onChange?.(next)
  }, [active, labels, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleToggle()
      }
    },
    [handleToggle]
  )

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative inline-flex cursor-pointer items-center justify-between rounded-full p-[1px]',
        'bg-bg1 select-none dark:bg-bg1d'
      )}
      role="switch"
      aria-checked={activeIndex === 1}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      style={{
        border: `1px solid ${colors[activeIndex]}`,
        height: '40px',
        minWidth: '180px',
        transition: 'border-color 0.25s ease'
      }}>
      <div
        className="absolute top-[1px] left-[1px] h-[calc(100%-2px)] rounded-full"
        style={{
          width: halfWidth ? `${halfWidth - 2}px` : '50%',
          border: `1px solid ${colors[activeIndex]}`,
          backgroundColor: `color-mix(in srgb, ${colors[activeIndex]} 10%, transparent)`,
          transform: `translateX(${activeIndex === 0 ? 0 : halfWidth - 2}px)`,
          transition:
            'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s ease, background-color 0.25s ease'
        }}
      />

      <div
        className={clsx(
          'relative z-10 flex flex-1 items-center justify-center px-4 text-center font-medium transition-colors',
          active === labels[0] ? 'text-[var(--color-a)]' : 'text-gray1 dark:text-gray1d'
        )}
        style={{ '--color-a': colors[0] } as React.CSSProperties}>
        {labels[0]}
      </div>

      <div
        className={clsx(
          'relative z-10 flex flex-1 items-center justify-center px-2 text-center font-medium transition-colors',
          active === labels[1] ? 'text-[var(--color-b)]' : 'text-gray1 dark:text-gray1d'
        )}
        style={{ '--color-b': colors[1] } as React.CSSProperties}>
        {labels[1]}
      </div>
    </div>
  )
}
