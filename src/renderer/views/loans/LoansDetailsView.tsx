import React, { useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address, Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
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
import { usePricePool } from '../../hooks/usePricePool'
import { PoolDetails } from '../../services/midgard/types'
import { BorrowerProviderRD, ThorchainLastblockRD } from '../../services/thorchain/types'
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
  const { asset, address } = props

  const intl = useIntl()

  const pricePool = usePricePool()
  const { getBorrowerProvider$, reloadBorrowerProvider, thorchainLastblockState$ } = useThorchainContext()

  const thorchainLastblockRD: ThorchainLastblockRD = useObservableState(thorchainLastblockState$, RD.pending)

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

  const lastBlock = FP.pipe(
    thorchainLastblockRD,
    RD.fold(
      () => O.none, // Handle the initial state
      () => O.none, // Handle the loading state
      () => O.none, // Handle the error state
      (blocks) =>
        FP.pipe(
          blocks,
          A.findFirst((blockInfo) => eqString.equals(blockInfo.chain, asset.chain)),
          O.map(({ thorchain }) => Number(thorchain))
        )
    ),
    O.getOrElse(() => 0) // Default to 0 if not found
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
      (borrowerData) => {
        const {
          debtCurrent,
          debtIssued,
          debtRepaid,
          collateralDeposited,
          collateralWithdrawn,
          collateralCurrent,
          lastRepayHeight
        } = borrowerData

        return (
          <LoanDetails
            asset={asset}
            priceAsset={pricePool.asset}
            current={{ amount: collateralCurrent, price: debtCurrent }}
            issued={{ amount: collateralDeposited, price: debtIssued }}
            repaid={{ amount: collateralWithdrawn, price: debtRepaid }}
            lastRepayHeight={lastRepayHeight}
            lastBlockTC={lastBlock}
          />
        )
      }
    )
  )
}
