import { useCallback } from 'react'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import type { Size } from './Button.types'
import { TextButton } from './TextButton'

export type Props = {
  label?: string
  size?: Size
  path?: string
  className?: string
}

export const BackLinkButton = ({ label, path, size = 'normal', className = '' }: Props): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()

  const clickHandler = useCallback(() => {
    if (path) {
      navigate(path)
    } else {
      // go back
      navigate(-1)
    }
  }, [path, navigate])

  return (
    <TextButton className={clsx('!p-0', className)} size={size} onClick={clickHandler}>
      <ChevronLeftIcon className="h-20px w-20px text-inherit" />
      <span className="hidden sm:inline-block">{label || intl.formatMessage({ id: 'common.back' })}</span>
    </TextButton>
  )
}
