import styled from 'styled-components'

import { AddressEllipsis as UIAddressEllipsis, Props as UIAddressEllipsisProps } from '../../addressEllipsis'
import { Size as UIAssetIconSize, FontSizes } from '../assetIcon'

const fontSizes: FontSizes = {
  large: 21,
  big: 19,
  normal: 16,
  small: 14,
  xsmall: 11
}

type AddressEllipsisProps = UIAddressEllipsisProps & { iconSize: UIAssetIconSize }
export const AddressEllipsis = styled(UIAddressEllipsis)<AddressEllipsisProps>`
  font-size: ${({ iconSize }) => `${fontSizes[iconSize]}px`};
  padding-left: 5px;
  text-transform: none;
`
