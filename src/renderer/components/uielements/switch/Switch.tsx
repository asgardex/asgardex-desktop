import { useState, useRef, useLayoutEffect } from 'react'
import clsx from 'clsx'
import { motion } from 'framer-motion'

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

  useLayoutEffect(() => {
    if (containerRef.current) {
      setHalfWidth(containerRef.current.offsetWidth / 2)
    }
  }, [labels, active])

  const handleToggle = () => {
    const next = active === labels[0] ? labels[1] : labels[0]
    setActive(next)
    onChange?.(next)
  }

  return (
    <motion.div
      ref={containerRef}
      className={clsx(
        'relative inline-flex cursor-pointer items-center justify-between rounded-full p-[1px]',
        'select-none bg-gray-100 transition-colors dark:bg-gray-900'
      )}
      onClick={handleToggle}
      animate={{ borderColor: colors[activeIndex] }}
      transition={{ type: 'tween', duration: 0.25 }}
      style={{
        border: `1px solid ${colors[activeIndex]}`,
        height: '40px',
        minWidth: '180px'
      }}>
      <motion.div
        layout
        className="absolute left-[1px] top-[1px] h-[calc(100%-2px)] rounded-full"
        style={{
          width: halfWidth ? `${halfWidth - 2}px` : '50%',
          border: `1px solid ${colors[activeIndex]}`,
          backgroundColor: colors[activeIndex] + '1A'
        }}
        animate={{
          x: activeIndex === 0 ? 0 : halfWidth - 2,
          borderColor: colors[activeIndex],
          backgroundColor: colors[activeIndex] + '1A'
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      />

      <div
        className={clsx(
          'relative z-10 flex flex-1 items-center justify-center px-4 text-center font-medium transition-colors',
          active === labels[0] ? 'text-[var(--color-a)]' : 'text-gray-500'
        )}
        style={{ '--color-a': colors[0] } as React.CSSProperties}>
        {labels[0]}
      </div>

      <div
        className={clsx(
          'relative z-10 flex flex-1 items-center justify-center px-2 text-center font-medium transition-colors',
          active === labels[1] ? 'text-[var(--color-b)]' : 'text-gray-500'
        )}
        style={{ '--color-b': colors[1] } as React.CSSProperties}>
        {labels[1]}
      </div>
    </motion.div>
  )
}
