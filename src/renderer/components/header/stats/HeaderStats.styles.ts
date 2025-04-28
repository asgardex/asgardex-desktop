import Text from 'antd/lib/typography/Text'
import styled from 'styled-components'
import { palette } from 'styled-theme'

export const Label = styled(Text)<{ loading: 'true' | 'false' }>`
  text-transform: uppercase;
  font-family: 'MainFontBold';
  font-size: 12px;
  line-height: 14px;
  color: ${({ loading }) => (loading === 'true' ? palette('text', 2) : palette('text', 2))};
  width: auto;
  padding: 0;
  margin: 0;
`

export const Protocol = styled(Text)`
  text-transform: uppercase;
  font-family: 'MainFontBold';
  font-size: 12px;
  line-height: 14px;
  color: ${palette('primary', 2)};
  width: auto;
  padding: 0;
  margin: 0;
`
