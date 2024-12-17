import React, { useMemo, useRef } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, AssetType } from '@xchainjs/xchain-util'
import { formatAssetAmount, assetToString, AssetAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { chainToString } from '../../../../../shared/utils/chain'
import { isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { loadingString, emptyString } from '../../../../helpers/stringHelper'
import { getAssetAmountByAsset } from '../../../../helpers/walletHelper'
import { NonEmptyWalletBalances } from '../../../../services/wallet/types'
import { AssetIcon } from '../assetIcon'

type Props = {
  asset: O.Option<AnyAsset>
  // balances are optional:
  // No balances == don't render price
  // balances == render price
  assetsWB?: O.Option<NonEmptyWalletBalances>
  walletInfo?: O.Option<{
    walletType: WalletType
  }>
  network: Network
}

export const AssetInfo = (props: Props): JSX.Element => {
  const intl = useIntl()
  const { assetsWB = O.none, asset: oAsset, walletInfo: oWalletInfo = O.none, network } = props

  const previousBalance = useRef<O.Option<AssetAmount>>(O.none)

  const renderAssetIcon = useMemo(
    () =>
      FP.pipe(
        oAsset,
        O.map((asset) => <AssetIcon asset={asset} size="big" key={assetToString(asset)} network={network} />),
        O.getOrElse(() => <></>)
      ),
    [oAsset, network]
  )

  const renderLedgerWalletType = useMemo(
    () =>
      FP.pipe(
        oWalletInfo,
        O.filter(({ walletType }) => isLedgerWallet(walletType)),
        O.map(() => intl.formatMessage({ id: 'ledger.title' })),
        O.getOrElse(() => '')
      ),
    [intl, oWalletInfo]
  )

  const renderBalance = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(assetsWB, oAsset),
        O.fold(
          () =>
            FP.pipe(
              previousBalance.current,
              O.map((amount) => formatAssetAmount({ amount, trimZeros: true })),
              O.getOrElse(() => emptyString)
            ),
          ([assetsWB, asset]) =>
            FP.pipe(
              getAssetAmountByAsset(assetsWB, asset),
              // save latest amount (if available only)
              O.map((amount) => {
                previousBalance.current = O.some(amount)
                return amount
              }),
              // use previous stored balances if amount is not available,
              // because `assetsWB` is loaded in parallel for all assets of different chains
              O.alt(() => previousBalance.current),
              O.map((amount) => formatAssetAmount({ amount, trimZeros: true })),
              O.getOrElse(() => loadingString)
            )
        )
      ),
    [oAsset, assetsWB]
  )

  return (
    <div className="flex flex-col items-center">
      {renderAssetIcon}
      <div className="mt-2 flex items-center">
        <div className="rounded-md bg-gray0 px-2 py-0.5 font-main text-[12px] uppercase text-text2 dark:bg-gray0d dark:text-text2d">
          {FP.pipe(
            oAsset,
            O.map(({ chain, type }) => (type === AssetType.SYNTH ? 'synth' : chainToString(chain))),
            O.getOrElse(() => loadingString)
          )}{' '}
          {renderLedgerWalletType ? `(${renderLedgerWalletType})` : ''}
        </div>
      </div>
      <div className="p-0 font-main text-[20px] uppercase text-text0 dark:text-text0d">
        {renderBalance}{' '}
        {FP.pipe(
          oAsset,
          O.map(({ ticker }) => ticker),
          O.getOrElse(() => loadingString)
        )}
      </div>
    </div>
  )
}
