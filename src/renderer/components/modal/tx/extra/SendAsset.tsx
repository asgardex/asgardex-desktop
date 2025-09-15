import { Network } from '@xchainjs/xchain-client'

import * as Styled from './Common.styles'
import * as C from './Common.types'

type Props = {
  asset: C.AssetData
  description: string
  network: Network
}

export const SendAsset = (props: Props): JSX.Element => {
  const { asset, description = '', network } = props
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Styled.StepLabel>{description}</Styled.StepLabel>
      <Styled.DataWrapper>
        <Styled.AssetsContainer>
          <Styled.AssetData size="big" asset={asset.asset} amount={asset.amount} network={network} />
        </Styled.AssetsContainer>
      </Styled.DataWrapper>
    </div>
  )
}
