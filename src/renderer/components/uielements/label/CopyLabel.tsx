import { useCallback, useEffect, useRef, useState } from 'react'
import { DocumentDuplicateIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import { logger } from '../../../helpers/logger'

type Props = {
  label?: string
  textToCopy: string
  className?: string
  iconClassName?: string
}

type CopyState = 'idle' | 'copied' | 'failed'

export const CopyLabel = ({ label, textToCopy, className = '', iconClassName = '' }: Props): JSX.Element => {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopyState('copied')
    } catch (err) {
      logger.error('Failed to copy text', err)
      setCopyState('failed')
    }
    timerRef.current = setTimeout(() => setCopyState('idle'), 1500)
  }, [textToCopy])

  return (
    <div
      className={clsx('group flex cursor-pointer items-center text-turquoise transition-colors', className)}
      onClick={handleCopy}>
      {label && <span className={clsx('mr-1 font-main text-inherit', className)}>{label}</span>}
      {copyState === 'copied' ? (
        <CheckIcon className={clsx('h-5 w-5 text-turquoise', iconClassName)} />
      ) : copyState === 'failed' ? (
        <XMarkIcon className={clsx('h-5 w-5 text-error0 dark:text-error0d', iconClassName)} />
      ) : (
        <DocumentDuplicateIcon
          className={clsx('h-5 w-5 text-text2 group-hover:text-inherit dark:text-text2d', iconClassName)}
        />
      )}
    </div>
  )
}
