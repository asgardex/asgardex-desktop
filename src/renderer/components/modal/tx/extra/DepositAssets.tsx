import { useMemo } from 'react'

import { ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import styled from 'styled-components'

import { AssetData as UIAssetData } from '../../../uielements/assets/assetData'
import * as Styled from './Common.styles'
import * as C from './Common.types'

// Deposit-specific styled components
const DepositDataWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  gap: 20px;
`

const DepositIconContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
`

const DepositAssetData = styled(UIAssetData)`
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
  source: O.Option<C.AssetData>
  target: C.AssetData
  stepDescription: string
  network: Network
  isWithdraw?: boolean
}

export const DepositAssets = (props: Props): JSX.Element => {
  const { source: oSource, target, stepDescription, network, isWithdraw = false } = props

  const hasSource = useMemo(() => FP.pipe(oSource, O.isSome), [oSource])

  const renderSource = useMemo(
    () =>
      FP.pipe(
        oSource,
        O.map(({ asset, amount }) => (
          <DepositAssetData key="source-data" asset={asset} amount={amount} network={network} size="big" />
        )),
        O.getOrElse(() => <></>)
      ),
    [oSource, network]
  )

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Styled.StepLabel>{stepDescription}</Styled.StepLabel>
      <DepositDataWrapper>
        {renderSource}
        {hasSource && (
          <DepositIconContainer>
            {isWithdraw ? (
              <ArrowLeftIcon className="w-8 h-8 text-gray-400" />
            ) : (
              <ArrowRightIcon className="w-8 h-8 text-gray-400" />
            )}
          </DepositIconContainer>
        )}
        <DepositAssetData asset={target.asset} amount={target.amount} network={network} size="big" />
      </DepositDataWrapper>
    </div>
  )
}

export type claimProps = {
  source: O.Option<C.AssetData>
  stepDescription: string
  network: Network
}

export const ClaimAsset = (props: claimProps): JSX.Element => {
  const { source: oSource, stepDescription, network } = props

  const renderSource = useMemo(
    () =>
      FP.pipe(
        oSource,
        O.map(({ asset, amount }) => (
          <Styled.AssetData key="source-data" asset={asset} amount={amount} network={network} />
        )),
        O.getOrElse(() => <></>)
      ),
    [oSource, network]
  )

  return (
    <>
      <Styled.StepLabel>{stepDescription}</Styled.StepLabel>
      <Styled.DataWrapper>
        <Styled.AssetsContainer>{renderSource}</Styled.AssetsContainer>
      </Styled.DataWrapper>
    </>
  )
}
