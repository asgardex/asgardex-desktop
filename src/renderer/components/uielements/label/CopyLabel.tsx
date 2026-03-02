import { useCallback, useEffect, useRef, useState } from 'react'
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import { logger } from '../../../helpers/logger'

type Props = {
  label?: string
  textToCopy: string
  className?: string
  iconClassName?: string
}

export const CopyLabel = ({ label, textToCopy, className = '', iconClassName = '' }: Props): JSX.Element => {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)

      // Clear previous timer if it exists
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      logger.error('Failed to copy text', err)
    }
  }, [textToCopy])

  return (
    <div
      className={clsx('group flex cursor-pointer items-center text-turquoise transition-colors', className)}
      onClick={handleCopy}>
      {label && <span className={clsx('mr-1 font-main text-inherit', className)}>{label}</span>}
      {copied ? (
        <CheckIcon className={clsx('h-5 w-5 text-turquoise', iconClassName)} />
      ) : (
        <DocumentDuplicateIcon
          className={clsx('h-5 w-5 text-text2 group-hover:text-inherit dark:text-text2d', iconClassName)}
        />
      )}
    </div>
  )
}
