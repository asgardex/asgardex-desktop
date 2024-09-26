import { useEffect, useState } from 'react'

import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../shared/api/types'
import { isLedgerWallet } from '../../shared/utils/guard'
import { WalletAddress, WalletType } from '../../shared/wallet/types'
import { useChainContext } from '../contexts/ChainContext'
import { useWalletContext } from '../contexts/WalletContext'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'

/**
 * Hook to provide wallet addresses needed for sym. deposit
 *
 * As always: Use it at `view` level only (not in components)
 */
export const useSymDepositAddresses = ({
  asset: oAsset,
  dex,
  assetWalletType,
  runeWalletType
}: {
  asset: O.Option<AnyAsset>
  dex: Dex
  assetWalletType: WalletType
  runeWalletType: WalletType
}) => {
  const { addressByChain$ } = useChainContext()

  const { getLedgerAddress$ } = useWalletContext()

  const [oDexWalletAddress, setODexWalletAddress] = useState<O.Option<WalletAddress>>(O.none)
  const [oAssetWalletAddress, setOAssetWalletAddress] = useState<O.Option<WalletAddress>>(O.none)
  const [oAssetLedgerWalletAddress, setOAssetLedgerWalletAddress] = useState<O.Option<WalletAddress>>(O.none)

  useEffect(() => {
    const subscription = FP.pipe(addressByChain$(dex.chain)).subscribe(setODexWalletAddress)
    const oRouteAssetSubscription = FP.pipe(
      oAsset,
      O.fold(
        () => Rx.of(O.none),
        ({ chain }) => addressByChain$(chain)
      )
    ).subscribe(setOAssetWalletAddress)
    const oLedgerAssetAddress = FP.pipe(
      oAsset,
      O.fold(
        () => Rx.of(O.none),
        ({ chain }) => FP.pipe(getLedgerAddress$(chain), RxOp.map(O.map(ledgerAddressToWalletAddress)))
      )
    ).subscribe(setOAssetLedgerWalletAddress)
    return () => {
      subscription.unsubscribe()
      oRouteAssetSubscription.unsubscribe()
      oLedgerAssetAddress.unsubscribe()
    }
  }, [addressByChain$, dex, getLedgerAddress$, oAsset])

  const [runeLedgerAddress] = useObservableState(
    () => FP.pipe(getLedgerAddress$(THORChain), RxOp.map(O.map(ledgerAddressToWalletAddress))),
    O.none
  )

  const symDepositAddresses = {
    asset: isLedgerWallet(assetWalletType) ? oAssetLedgerWalletAddress : oAssetWalletAddress,
    rune: isLedgerWallet(runeWalletType) ? runeLedgerAddress : oDexWalletAddress
  }

  return {
    addresses: symDepositAddresses
  }
}
