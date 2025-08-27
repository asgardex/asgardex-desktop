import { useCallback, useRef, useState } from 'react'
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

type Props = {
  label?: string
  textToCopy: string
  className?: string
  iconClassName?: string
}

export const CopyLabel = ({ label, textToCopy, className = '', iconClassName = '' }: Props): JSX.Element => {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)

      // Clear previous timer if it exists
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy text', err)
    }
  }, [textToCopy])

  return (
    <button
      className={clsx('flex items-center text-turquoise group transition-colors', className)}
      type="button"
      aria-label={label ?? 'Copy to clipboard'}
      onClick={handleCopy}>
      {label && <span className={clsx('mr-1 font-main uppercase text-inherit', className)}>{label}</span>}
      {copied ? (
        <CheckIcon className={clsx('h-5 w-5 text-turquoise', iconClassName)} />
      ) : (
        <DocumentDuplicateIcon
          className={clsx('h-5 w-5 text-text2 dark:text-text2d group-hover:text-inherit', iconClassName)}
        />
      )}
    </button>
  )
}
