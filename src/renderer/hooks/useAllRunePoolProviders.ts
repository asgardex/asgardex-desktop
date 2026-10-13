import { useState, useEffect } from 'react'

import { Chain } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletAddress, WalletType } from '../../shared/wallet/types'
import { isThorChain } from '../helpers/chainHelper'
import { RunePoolProviderRD } from '../services/thorchain/types'
import { LedgerAddress } from '../services/wallet/types'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'

export const useRunePoolProviders = (
  userChains$: Rx.Observable<Chain[]>,
  addressByChain$: (chain: Chain) => Rx.Observable<O.Option<WalletAddress>>,
  getLedgerAddress$: (chain: Chain) => Rx.Observable<O.Option<LedgerAddress>>,
  getRunePoolProvider$: (address: string, type: WalletType) => Rx.Observable<RunePoolProviderRD>,
  enabled = true
) => {
  const [allRunePoolProviders, setAllRunePoolProviders] = useState<Record<string, RunePoolProviderRD>>({})

  useEffect(() => {
    if (!enabled) return

    const subscription = userChains$
      .pipe(
        RxOp.switchMap((enabledChains) => {
          const keystoreAddresses$ = FP.pipe(
            enabledChains,
            A.filter((chain) => isThorChain(chain)),
            A.map(addressByChain$)
          )
          const ledgerAddresses$ = FP.pipe(
            enabledChains,
            A.filter((chain) => isThorChain(chain)),
            A.map((chain) => getLedgerAddress$(chain)),
            A.map(RxOp.map(FP.flow(O.map(ledgerAddressToWalletAddress))))
          )
          const addressStreams = [...keystoreAddresses$, ...ledgerAddresses$]
          if (addressStreams.length === 0) return Rx.of(null)

          return Rx.combineLatest(addressStreams).pipe(
            RxOp.map((addressOptionsArray) => FP.pipe(addressOptionsArray, A.filterMap(FP.identity))),
            RxOp.map((walletAddresses) =>
              walletAddresses.map((walletAddress) => ({
                address: walletAddress.address,
                type: walletAddress.type
              }))
            ),
            RxOp.switchMap((walletAddresses) => {
              if (walletAddresses.length === 0) return Rx.of(null)
              return Rx.combineLatest(
                walletAddresses.map((walletAddress) => getRunePoolProvider$(walletAddress.address, walletAddress.type))
              )
            })
          )
        })
      )
      .subscribe((runePoolProviders) => {
        if (!runePoolProviders) return
        runePoolProviders.forEach((provider) => {
          if (provider && provider._tag === 'RemoteSuccess' && provider.value.depositAmount.amount().gt(0)) {
            const key = `${provider.value.address}.${provider.value.walletType}`
            setAllRunePoolProviders((prev) => ({ ...prev, [key]: provider }))
          }
        })
      })

    return () => subscription.unsubscribe()
  }, [enabled, userChains$, addressByChain$, getLedgerAddress$, getRunePoolProvider$])

  return allRunePoolProviders
}
