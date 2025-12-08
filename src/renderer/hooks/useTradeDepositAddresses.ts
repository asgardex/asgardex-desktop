import { useEffect, useState } from 'react'

import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { isLedgerWallet } from '../../shared/utils/guard'
import { WalletAddress, WalletType } from '../../shared/wallet/types'
import { useChainContext } from '../contexts/ChainContext'
import { useWalletContext } from '../contexts/WalletContext'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'

/**
 * Hook to provide user's protocol address for trade deposit memos
 */
export const useTradeDepositAddresses = ({ protocol, walletType }: { protocol: Chain; walletType: WalletType }) => {
  const { addressByChain$ } = useChainContext()
  const { getLedgerAddress$ } = useWalletContext()

  const [oProtocolAddress, setOProtocolAddress] = useState<O.Option<WalletAddress>>(O.none)

  // Get keystore address
  useEffect(() => {
    if (!isLedgerWallet(walletType)) {
      const subscription = addressByChain$(protocol).subscribe(setOProtocolAddress)
      return () => subscription.unsubscribe()
    }
  }, [addressByChain$, protocol, walletType])

  // Get ledger address for THORChain
  const [thorLedgerAddress] = useObservableState(
    () => FP.pipe(getLedgerAddress$(THORChain), RxOp.map(O.map(ledgerAddressToWalletAddress))),
    O.none
  )

  // Get ledger address for MAYAChain
  const [mayaLedgerAddress] = useObservableState(
    () => FP.pipe(getLedgerAddress$(MAYAChain), RxOp.map(O.map(ledgerAddressToWalletAddress))),
    O.none
  )

  const finalAddress = isLedgerWallet(walletType)
    ? protocol === THORChain
      ? thorLedgerAddress
      : mayaLedgerAddress
    : oProtocolAddress

  return {
    protocolAddress: finalAddress
  }
}
