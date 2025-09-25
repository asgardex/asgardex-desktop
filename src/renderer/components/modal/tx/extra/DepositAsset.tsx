import { useMemo } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'

import * as Styled from './Common.styles'
import * as C from './Common.types'

type Props = {
  source: O.Option<C.AssetData>
  stepDescription: string
  network: Network
}

export const DepositAsset = (props: Props): JSX.Element => {
  const { source: oSource, stepDescription, network } = props

  const hasSource = useMemo(() => FP.pipe(oSource, O.isSome), [oSource])

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
    <div className="flex flex-col items-center justify-center w-full">
      <Styled.StepLabel>{stepDescription}</Styled.StepLabel>
      <Styled.DataWrapper>
        {hasSource && <Styled.StepBar size={50} />}
        <Styled.AssetsContainer>{renderSource}</Styled.AssetsContainer>
      </Styled.DataWrapper>
    </div>
  )
}
