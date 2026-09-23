import { useMemo } from 'react'

import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import { BorderButton } from '../button'

export type NewsTickerProps = {
  messages: string[]
  onDismiss?: () => void
  className?: string
  /** Optional label shown in the left badge (default: ALERT). */
  badgeLabel?: string
}

const SEPARATOR = '◆'

/** Seconds for one full loop — longer copy scrolls a bit longer so it stays readable. */
const scrollDurationSec = (joinedLength: number): number => Math.min(90, Math.max(18, joinedLength * 0.07))

/**
 * Compact news-style marquee: messages scroll right → left in one strip.
 * Pauses on hover; respects `prefers-reduced-motion`.
 */
export const NewsTicker = ({ messages, onDismiss, className, badgeLabel = 'ALERT' }: NewsTickerProps): JSX.Element => {
  const items = useMemo(() => messages.map((m) => m.trim()).filter(Boolean), [messages])

  const joined = useMemo(() => items.join(`   ${SEPARATOR}   `), [items])
  const durationSec = scrollDurationSec(joined.length)

  if (items.length === 0) return <></>

  return (
    <div
      className={clsx(
        'group relative flex h-9 items-stretch overflow-hidden rounded-lg border border-warning0/80 bg-warning0/10',
        className
      )}
      role="status"
      aria-live="polite">
      {/* Left badge */}
      <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-warning0/40 bg-warning0/20 px-2.5">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning0 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-warning0" />
        </span>
        <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-warning0" aria-hidden />
        <span className="font-main-bold text-11 font-bold tracking-wider text-warning0 uppercase">{badgeLabel}</span>
      </div>

      {/* Scrolling viewport */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[rgba(243,186,47,0.12)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[rgba(243,186,47,0.12)] to-transparent" />

        {/* Reduced motion: static truncated line */}
        <div className="hidden h-full items-center px-3 motion-reduce:flex">
          <p className="truncate font-main text-11 tracking-wide text-text0 uppercase dark:text-text0d">{joined}</p>
        </div>

        {/* Animated marquee */}
        <div className="flex h-full items-center overflow-hidden motion-reduce:hidden">
          <div
            className="news-ticker-track flex w-max items-center whitespace-nowrap group-hover:[animation-play-state:paused]"
            style={{ animationDuration: `${durationSec}s` }}>
            {/* Duplicate the strip for a seamless loop (translateX -50%) */}
            {[0, 1].map((copy) => (
              <span
                key={copy}
                className="inline-flex items-center px-6 font-main text-11 tracking-wide text-text0 uppercase dark:text-text0d">
                {items.map((msg, idx) => (
                  <span key={`${copy}-${idx}`} className="inline-flex items-center">
                    <span>{msg}</span>
                    <span className="mx-4 text-warning0/70" aria-hidden>
                      {SEPARATOR}
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {onDismiss && (
        <div className="z-10 flex shrink-0 items-center border-l border-warning0/40 bg-warning0/10 px-1">
          <BorderButton
            size="small"
            onClick={onDismiss}
            className="p-1 hover:bg-bg1 dark:hover:bg-bg1d"
            aria-label="Dismiss alerts">
            <XMarkIcon className="h-4 w-4" />
          </BorderButton>
        </div>
      )}
    </div>
  )
}
