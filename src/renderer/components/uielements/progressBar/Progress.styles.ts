import { Progress, ProgressProps } from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

export const ProgressWrapper = styled(Progress)<ProgressProps & { percent: number }>`
  margin-bottom: 10px;
`

export const ProgressLabel = styled.div.attrs({ className: 'progressLabel' })`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: inherit;
  font-size: 12px;
  color: ${palette('text', 2)};
`
