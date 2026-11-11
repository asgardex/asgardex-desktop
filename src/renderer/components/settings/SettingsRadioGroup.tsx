import { KeyboardEvent, useRef } from 'react'

import clsx from 'clsx'

import { SETTINGS_FOCUS_RING } from './settingsUi'

type Option<T> = { value: T; label: string }

type Props<T> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

/**
 * Segmented radio group (ARIA radio pattern): only the selected option is a tab stop,
 * arrow keys (and Home / End) move the selection and the focus.
 */
export const SettingsRadioGroup = <T,>({ options, value, onChange, ariaLabel }: Props<T>): JSX.Element => {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  // Without a selected option the first one is the tab stop
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0

  const select = (index: number) => {
    onChange(options[index].value)
    refs.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1
    const next = (() => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          return index === last ? 0 : index + 1
        case 'ArrowLeft':
        case 'ArrowUp':
          return index === 0 ? last : index - 1
        case 'Home':
          return 0
        case 'End':
          return last
        default:
          return undefined
      }
    })()
    if (next === undefined) return
    event.preventDefault()
    select(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex max-w-full flex-wrap items-center justify-end gap-1 rounded-lg bg-bg2 p-1 dark:bg-bg2d/50">
      {options.map((option, index) => {
        const selected = index === selectedIndex
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={clsx(
              'rounded-md px-2.5 py-1 font-main text-[12px] transition-colors',
              SETTINGS_FOCUS_RING,
              selected
                ? 'bg-bg0 text-text0 shadow-sm dark:bg-bg2d dark:text-text0d'
                : 'text-text2 hover:text-text0 dark:text-text2d dark:hover:text-text0d'
            )}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
