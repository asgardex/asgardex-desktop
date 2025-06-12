import { AnyAsset } from '@xchainjs/xchain-util'

import * as Styled from './AssetLabel.styles'

type Props = {
  asset: AnyAsset
  className?: string
}

export const AssetLabel = (props: Props) => {
  const { asset, className } = props

  return (
    <Styled.Wrapper className={className}>
      <Styled.Col>
        <Styled.TickerLabel>{asset.ticker}</Styled.TickerLabel>
        <Styled.ChainLabel>{asset.chain}</Styled.ChainLabel>
      </Styled.Col>
    </Styled.Wrapper>
  )
}
