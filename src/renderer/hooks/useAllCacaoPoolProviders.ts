import { useState, useEffect } from 'react'

import { Chain } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletAddress, WalletType } from '../../shared/wallet/types'
import { isMayaChain } from '../helpers/chainHelper'
import { CacaoPoolProviderRD } from '../services/mayachain/types'
import { LedgerAddress } from '../services/wallet/types'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'

export const useCacaoPoolProviders = (
  userChains$: Rx.Observable<Chain[]>,
  addressByChain$: (chain: Chain) => Rx.Observable<O.Option<WalletAddress>>,
  getLedgerAddress$: (chain: Chain) => Rx.Observable<O.Option<LedgerAddress>>,
  getCacaoPoolProvider$: (address: string, type: WalletType) => Rx.Observable<CacaoPoolProviderRD>
) => {
  const [allCacaoPoolProviders, setAllCacaoPoolProviders] = useState<Record<string, CacaoPoolProviderRD>>({})

  useEffect(() => {
    const userChainsSubscription = userChains$.subscribe((enabledChains) => {
      // Keystore addresses
      const keystoreAddresses$ = FP.pipe(
        enabledChains,
        A.filter((chain) => isMayaChain(chain)),
        A.map(addressByChain$)
      )

      // Ledger addresses
      const ledgerAddresses$ = FP.pipe(
        enabledChains,
        A.filter((chain) => isMayaChain(chain)),
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
                walletAddresses.map((walletAddress) => getCacaoPoolProvider$(walletAddress.address, walletAddress.type))
              )
            }
            return Rx.of(null)
          })
        )
        .subscribe((cacaoPoolProviders) => {
          if (cacaoPoolProviders) {
            cacaoPoolProviders.forEach((provider) => {
              if (provider && provider._tag === 'RemoteSuccess' && provider.value.depositAmount.amount().gt(0)) {
                const key = `${provider.value.address}.${provider.value.walletType}`
                setAllCacaoPoolProviders((prev) => ({ ...prev, [key]: provider }))
              }
            })
          }
        })

      return () => {
        subscriptions.unsubscribe()
        userChainsSubscription.unsubscribe()
      }
    })
  }, [userChains$, addressByChain$, getLedgerAddress$, getCacaoPoolProvider$])

  return allCacaoPoolProviders
}
