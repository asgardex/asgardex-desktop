import { Row } from 'antd'
import styled from 'styled-components'

import { media } from '../../../helpers/styleHelper'
import { AssetLabel as AssetLabelUI } from '../../uielements/assets/assetLabel'
import { WalletTypeLabel as WalletTypeLabelUI } from '../../uielements/common/Common.styles'
import { Label as UILabel } from '../../uielements/label'

export const Container = styled('div')`
  .sliderLabel {
    font-size: 21px;
    font-family: 'MainFontSemiBold';
  }
`

export const AssetOutputContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 20px 0;

  &:last-child {
    margin: 0;
  }

  > div:first-child {
    margin-right: 10px;
  }
`

export const OutputLabel = styled(UILabel)`
  font-family: 'MainFontBold';
  padding: 0;
  font-size: 24px;
  line-height: 25px;

  ${media.md`
  font-size: 27px;
  line-height: 29px;
`}
`

export const OutputUSDLabel = styled(UILabel)`
  font-family: 'MainFontRegular';
  padding: 0;
  font-size: 11px;
  line-height: 11px;
  white-space: normal;

  ${media.md`
  font-size: 13px;
  line-height: 13px;
`}
`
export const FeesRow = styled(Row)`
  width: 100%;
`

export const FeeRow = styled(Row).attrs({
  align: 'middle'
})`
  padding-bottom: 20px;

  ${media.xl`
    padding-bottom: 0px;
`}
`

export const FeeErrorRow = styled(Row).attrs({
  align: 'middle'
})`
  padding-bottom: 20px;

  ${media.xl`
    padding-top: 20px;
    padding-bottom: 0px;
`}
`

export const AssetLabel = styled(AssetLabelUI)`
  padding: 0px;
  margin: 0;
`

export const WalletTypeLabel = styled(WalletTypeLabelUI)`
  font-size: 8px;
  line-height: 12px;
  margin-right: 10px;

  ${media.md`
  font-size: 10px;
`}
`
