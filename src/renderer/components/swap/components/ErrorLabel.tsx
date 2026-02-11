import { ReactNode } from 'react'

import clsx from 'clsx'

type Props = {
  children: ReactNode
  className?: string
}

export const ErrorLabel = ({ children, className }: Props): JSX.Element => (
  <div
    className={clsx('mb-[14px] text-center font-main text-[12px] text-error0 uppercase dark:text-error0d', className)}>
    {children}
  </div>
)
