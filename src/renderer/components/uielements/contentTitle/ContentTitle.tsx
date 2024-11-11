import React from 'react'

import clsx from 'clsx'

import { ContentTitleWrapper } from './ContentTitle.styles'

export type Props = {
  className?: string
  children: React.ReactNode
}

export const ContentTitle: React.FC<Props> = ({ className = '', children, ...otherProps }): JSX.Element => {
  return (
    <ContentTitleWrapper className={clsx('contentTitle-wrapper', className)} {...otherProps}>
      {children}
    </ContentTitleWrapper>
  )
}
