import React from 'react'

import { ViewWrapper } from './View.styles'

export const View = ({ children }: { children: React.ReactNode }): JSX.Element => <ViewWrapper>{children}</ViewWrapper>
