import styled from 'styled-components'
import { palette } from 'styled-theme'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  overflow: auto;
  justify-content: center; /* Align children vertically in the center */
  align-items: center;
  background-color: ${palette('background', 0)};
`
