import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'
import styled from 'styled-components'

import { AssetData as UIAssetData } from '../../../uielements/assets/assetData'
import { Label } from '../../../uielements/label'
import * as Styled from './Common.styles'
import * as C from './Common.types'

// Swap-specific styled components
const SwapDataWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  gap: 20px;
`

const SwapIconContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`

const SwapAssetData = styled(UIAssetData)`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;

  /* Ensure consistent left alignment for all asset rows */
  & > div {
    justify-content: flex-start;
    align-items: center;
  }
`

export type Props = {
  source: C.AssetData
  target: C.AssetData
  stepDescription: string
  network: Network
}

export const SwapAssets = (props: Props): JSX.Element => {
  const { source, target, stepDescription, network } = props
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Styled.StepLabel>{stepDescription}</Styled.StepLabel>
      <SwapDataWrapper className="w-full !gap-1">
        <div className="flex items-center justify-between w-full px-10">
          <SwapAssetData asset={source.asset} network={network} size="small" />
          <Label className="text-3xl" align="right">
            {formatAssetAmount({ amount: baseToAsset(source.amount), trimZeros: true })}
          </Label>
        </div>
        <SwapIconContainer>
          <ArrowsRightLeftIcon className="w-8 h-8 text-gray-400 rotate-90" />
        </SwapIconContainer>
        <div className="flex items-center justify-between w-full px-10">
          <SwapAssetData asset={target.asset} network={network} size="small" />
          <Label className="text-3xl" align="right">
            {formatAssetAmount({ amount: baseToAsset(target.amount), trimZeros: true })}
          </Label>
        </div>
      </SwapDataWrapper>
    </div>
  )
}
