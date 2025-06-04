import { PlusIcon } from '@heroicons/react/24/outline'
import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { InnerForm } from '../shared/form'
import { Button as UIButton } from '../uielements/button'

export const Container = styled('div')`
  background: ${palette('background', 0)};
`

export const Form = styled(InnerForm)`
  display: flex;
  align-items: center;
`

export const Input = styled(A.Input)`
  background: inherit !important;
  color: ${palette('text', 0)};
  border: 1px solid ${palette('gray', 0)};
  border-radius: 8px;
`

export const SubmitButton = styled(UIButton).attrs({
  typevalue: 'transparent'
})``

export const AddIcon = styled(PlusIcon)`
  stroke: ${palette('text', 3)}; /* Heroicons use stroke for outline */
  background: ${palette('primary', 2)};
  border-radius: 50%;
  height: 18px;
  width: 18px;
`
