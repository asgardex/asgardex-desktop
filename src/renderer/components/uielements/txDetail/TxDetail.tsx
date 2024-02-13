import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { baseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as NEA from 'fp-ts/NonEmptyArray'
import * as O from 'fp-ts/Option'

import { CACAO_DECIMAL, isCacaoAsset } from '../../../helpers/assetHelper'
import { Fees } from '../fees'
import * as Styled from './TxDetail.styles'
import { ActionProps } from './types'

export const TxDetail: React.FC<ActionProps> = ({
  className,
  outgos,
  incomes,
  fees = [],
  slip,
  network,
  isDesktopView
}) => {
  const renderIncomes = useMemo(
    () =>
      FP.pipe(
        incomes,
        A.mapWithIndex((index, { asset, amount }) => (
          <Styled.InOutValueContainer key={`in-${index}`}>
            {isDesktopView && <Styled.AssetIcon size="xsmall" asset={asset} network={network} />}
            <Styled.InOutValue>
              {formatAssetAmountCurrency({
                trimZeros: false,
                amount: baseToAsset(
                  isCacaoAsset(asset) ? baseAmount(amount.amount().toNumber(), CACAO_DECIMAL) : amount
                ),
                asset
              })}
            </Styled.InOutValue>
          </Styled.InOutValueContainer>
        ))
      ),
    [incomes, network, isDesktopView]
  )

  const renderOutgos = useMemo(
    () =>
      FP.pipe(
        outgos,
        A.mapWithIndex((index, { asset, amount }) => {
          return (
            <Styled.InOutValueContainer key={`out-${index}`}>
              {isDesktopView && <Styled.AssetIcon size="xsmall" asset={asset} network={network} />}
              <Styled.InOutValue>
                {formatAssetAmountCurrency({
                  trimZeros: false,
                  amount: baseToAsset(
                    isCacaoAsset(asset) ? baseAmount(amount.amount().toNumber(), CACAO_DECIMAL) : amount
                  ),
                  asset
                })}
              </Styled.InOutValue>
            </Styled.InOutValueContainer>
          )
        })
      ),
    [outgos, network, isDesktopView]
  )

  const feesComponent = useMemo(
    () =>
      FP.pipe(
        fees,
        NEA.fromArray,
        O.map(RD.success),
        O.map((fees) => (
          <Styled.ContainerWithDelimeter key="fees">
            <Fees fees={fees} />
          </Styled.ContainerWithDelimeter>
        )),
        O.getOrElse(() => <></>)
      ),
    [fees]
  )

  return (
    <Styled.Container className={className}>
      <Styled.ValuesContainer>
        <Styled.InOutContainer>
          <Styled.InOutText>in</Styled.InOutText>
          {renderIncomes}
        </Styled.InOutContainer>
        <Styled.InOutContainer>
          {renderOutgos}
          <Styled.InOutText>out</Styled.InOutText>
        </Styled.InOutContainer>
      </Styled.ValuesContainer>

      <Styled.AdditionalInfoContainer>
        {feesComponent}
        {slip && <Styled.ContainerWithDelimeter>slip: {slip}%</Styled.ContainerWithDelimeter>}
      </Styled.AdditionalInfoContainer>
    </Styled.Container>
  )
}
