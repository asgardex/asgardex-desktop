import { useState, useEffect } from 'react'

import { Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletAddress, WalletType } from '../../shared/wallet/types'
import { isThorChain } from '../helpers/chainHelper'
import { RunePoolProviderRD } from '../services/thorchain/types'
import { LedgerAddress } from '../services/wallet/types'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'

// Type your RunePoolProviderRD and other relevant imports here

export const useRunePoolProviders = (
  userChains$: Rx.Observable<Chain[]>,
  addressByChain$: (chain: Chain) => Rx.Observable<O.Option<WalletAddress>>,
  getLedgerAddress$: (chain: Chain) => Rx.Observable<O.Option<LedgerAddress>>,
  getRunePoolProvider$: (address: string, type: WalletType) => Rx.Observable<RunePoolProviderRD>
) => {
  const [allRunePoolProviders, setAllRunePoolProviders] = useState<Record<string, RunePoolProviderRD>>({})

  useEffect(() => {
    const userChainsSubscription = userChains$.subscribe((enabledChains) => {
      // Keystore addresses
      const keystoreAddresses$ = FP.pipe(
        enabledChains,
        A.filter((chain) => isThorChain(chain)),
        A.map(addressByChain$)
      )

      // Ledger addresses
      const ledgerAddresses$ = FP.pipe(
        enabledChains,
        A.filter((chain) => isThorChain(chain)),
        A.map((chain) => getLedgerAddress$(chain)),
        A.map(RxOp.map(FP.flow(O.map(ledgerAddressToWalletAddress))))
      )

      const combinedAddresses$ = Rx.combineLatest([...keystoreAddresses$, ...ledgerAddresses$]).pipe(
        RxOp.map((addressOptionsArray) => FP.pipe(addressOptionsArray, A.filterMap(FP.identity))),
        RxOp.map((walletAddresses) =>
          walletAddresses.map((walletAddress) => ({
            address: walletAddress.address,
            type: walletAddress.type
          }))
        )
      )

      const subscriptions = combinedAddresses$
        .pipe(
          RxOp.switchMap((walletAddresses) => {
            if (walletAddresses.length > 0) {
              return Rx.combineLatest(
                walletAddresses.map((walletAddress) => getRunePoolProvider$(walletAddress.address, walletAddress.type))
              )
            }
            return Rx.of(null)
          })
        )
        .subscribe((runePoolProviders) => {
          if (runePoolProviders) {
            runePoolProviders.forEach((provider) => {
              if (provider && provider._tag === 'RemoteSuccess' && provider.value.depositAmount.amount().gt(0)) {
                const key = `${provider.value.address}.${provider.value.walletType}`
                setAllRunePoolProviders((prev) => ({ ...prev, [key]: provider }))
              }
            })
          }
        })

      return () => {
        subscriptions.unsubscribe()
        userChainsSubscription.unsubscribe()
      }
    })
  }, [userChains$, addressByChain$, getLedgerAddress$, getRunePoolProvider$])

  return allRunePoolProviders
}
