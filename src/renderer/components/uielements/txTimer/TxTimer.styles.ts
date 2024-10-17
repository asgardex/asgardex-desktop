import { CheckOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { palette } from 'styled-theme'

export const TxTimerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto;

  .timerchart-circular-progressbar {
    width: 100%;
    height: 100%;
    &.hide {
      visibility: hidden;
    }
  }

  .timerchart-icon {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`

export const IconWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${palette('gradient', 0)};
  border-radius: 50%; /* Ensures round background */
  width: 75%;
  height: 75%;
`

export const SuccessIcon = styled(CheckOutlined)`
  font-size: 35px;
  color: ${palette('primary', 0)};
`
