import React, { useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address, Asset, baseAmount } from '@xchainjs/xchain-util'
import * as Eq from 'fp-ts/lib/Eq'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { LoanDetails } from '../../components/loans/LoanDetails'
import { ErrorView } from '../../components/shared/error'
import { Spin } from '../../components/shared/loading'
import { FlatButton } from '../../components/uielements/button'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { eqAsset, eqString } from '../../helpers/fp/eq'
import * as PoolHelpers from '../../helpers/poolHelper'
import { usePricePool } from '../../hooks/usePricePool'
import { PoolDetails } from '../../services/midgard/types'
import { BorrowerProviderRD } from '../../services/thorchain/types'
import { UpdateBorrowerProvider } from './Loans.types'

type Props = {
  asset: Asset
  address: Address
  poolDetails: PoolDetails
}

const eqUpdaBorrowerProvider = Eq.struct<UpdateBorrowerProvider>({
  address: eqString,
  asset: eqAsset
})

export const LoansDetailsView: React.FC<Props> = (props): JSX.Element => {
  const { asset, address, poolDetails } = props

  const intl = useIntl()

  const pricePool = usePricePool()
  const { getBorrowerProvider$, reloadBorrowerProvider } = useThorchainContext()

  const [borrowerProviderRD, updateBorrowerProvider$] = useObservableState<
    BorrowerProviderRD,
    { address: Address; asset: Asset }
  >(
    (updated$) =>
      FP.pipe(
        updated$,
        RxOp.debounceTime(300),
        RxOp.distinctUntilChanged(eqUpdaBorrowerProvider.equals),
        RxOp.switchMap(({ address, asset }) => getBorrowerProvider$(asset, address))
      ),
    RD.initial
  )

  useEffect(() => {
    updateBorrowerProvider$({ address, asset })
  }, [address, asset, updateBorrowerProvider$])

  const renderLoading = () => (
    <div className="flex h-full w-full items-center justify-center">
      <Spin size="default" />,
    </div>
  )

  return FP.pipe(
    borrowerProviderRD,
    RD.fold(
      () => renderLoading(),
      () => renderLoading(),
      (error) => (
        <ErrorView
          title={intl.formatMessage({ id: 'common.error' })}
          subTitle={error?.message ?? error.toString()}
          extra={<FlatButton onClick={reloadBorrowerProvider}>{intl.formatMessage({ id: 'common.retry' })}</FlatButton>}
        />
      ),
      ({ debtCurrent, debtIssued, debtRepaid }) => {
        const debtCurrentPrice = FP.pipe(
          PoolHelpers.getPoolPriceValue({
            balance: { asset, amount: debtCurrent },
            poolDetails,
            pricePool
          }),
          O.getOrElse(() => baseAmount(0, debtCurrent.decimal))
        )

        const debtIssuedPrice = FP.pipe(
          PoolHelpers.getPoolPriceValue({
            balance: { asset, amount: debtIssued },
            poolDetails,
            pricePool
          }),
          O.getOrElse(() => baseAmount(0, debtIssued.decimal))
        )

        const debtRepaidPrice = FP.pipe(
          PoolHelpers.getPoolPriceValue({
            balance: { asset, amount: debtRepaid },
            poolDetails,
            pricePool
          }),
          O.getOrElse(() => baseAmount(0, debtRepaid.decimal))
        )

        return (
          <LoanDetails
            asset={asset}
            priceAsset={pricePool.asset}
            current={{ amount: debtCurrent, price: debtCurrentPrice }}
            issued={{ amount: debtIssued, price: debtIssuedPrice }}
            repaid={{ amount: debtRepaid, price: debtRepaidPrice }}
          />
        )
      }
    )
  )
}
