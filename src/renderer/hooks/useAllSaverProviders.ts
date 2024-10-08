import { useEffect, useState } from 'react'

import { AnyAsset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletType } from '../../shared/wallet/types'
import { useChainContext } from '../contexts/ChainContext'
import { useThorchainContext } from '../contexts/ThorchainContext'
import { useWalletContext } from '../contexts/WalletContext'
import { isMayaChain, isThorChain } from '../helpers/chainHelper'
import { userChains$ } from '../services/storage/userChains'
import { SaverProviderRD } from '../services/thorchain/types'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'

export const useAllSaverProviders = (poolAsset: AnyAsset[]) => {
  const { getSaverProvider$ } = useThorchainContext()
  const { addressByChain$ } = useChainContext()
  const { getLedgerAddress$ } = useWalletContext()

  const [allSaverProviders, setAllSaverProviders] = useState<Record<string, SaverProviderRD>>({})

  useEffect(() => {
    if (poolAsset) {
      const userChainsSubscription = userChains$.subscribe((enabledChains) => {
        const keystoreAddresses$ = FP.pipe(
          enabledChains,
          A.filter((chain) => !isThorChain(chain)),
          A.map(addressByChain$)
        )

        const ledgerAddresses$ = (): Rx.Observable<O.Option<{ chain: string; address: string; type: WalletType }>>[] =>
          FP.pipe(
            enabledChains,
            A.filter((chain) => !isThorChain(chain) || isMayaChain(chain)),
            A.map((chain) => getLedgerAddress$(chain)),
            A.map(RxOp.map(FP.flow(O.map(ledgerAddressToWalletAddress))))
          )

        const combinedAddresses$ = Rx.combineLatest([...keystoreAddresses$, ...ledgerAddresses$()]).pipe(
          RxOp.map((addressOptionsArray) => FP.pipe(addressOptionsArray, A.filterMap(FP.identity))),
          RxOp.map((walletAddresses) =>
            walletAddresses.map((walletAddress) => ({
              chain: walletAddress.chain,
              address: walletAddress.address,
              type: walletAddress.type
            }))
          )
        )

        const subscriptions = poolAsset.map((asset) => {
          return combinedAddresses$
            .pipe(
              RxOp.switchMap((walletAddresses) => {
                const addressesForAssetChain = walletAddresses.filter((wa) => wa.chain === asset.chain)
                if (addressesForAssetChain.length > 0) {
                  return Rx.combineLatest(
                    addressesForAssetChain.map((walletAddress) =>
                      getSaverProvider$(asset, walletAddress.address, walletAddress.type)
                    )
                  )
                }
                return Rx.of(null)
              })
            )
            .subscribe((saverProviders) => {
              if (saverProviders !== null) {
                saverProviders.forEach((saverProvider) => {
                  if (
                    saverProvider !== null &&
                    saverProvider._tag === 'RemoteSuccess' &&
                    saverProvider.value.depositValue.amount().gt(0)
                  ) {
                    const key = `${asset.chain}.${asset.symbol}`
                    setAllSaverProviders((prev) => ({ ...prev, [key]: saverProvider }))
                  }
                })
              }
            })
        })

        return () => {
          subscriptions.forEach((sub) => sub.unsubscribe())
          userChainsSubscription.unsubscribe()
        }
      })
    }
  }, [addressByChain$, getLedgerAddress$, getSaverProvider$, poolAsset])

  return { allSaverProviders, setAllSaverProviders }
}
