import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { getChainsForDex } from '../../shared/utils/chain'
import { useChainContext } from '../contexts/ChainContext'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { useWalletContext } from '../contexts/WalletContext'
import { addressFromWalletAddress } from '../helpers/walletHelper'
import { WalletAddress$ } from '../services/clients'
import { PoolShares } from '../services/midgard/types'
import { userChains$ } from '../services/storage/userChains'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'

export const usePoolShares = (protocol: Chain) => {
  const {
    service: {
      pools: { reloadAllPools },
      shares: { allSharesByAddresses$, reloadAllSharesByAddresses }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { reloadAllPools: reloadAllMayaPools },
      shares: {
        allSharesByAddresses$: allSharesByAddressesMaya$,
        reloadAllSharesByAddresses: reloadAllSharesByAddressesMaya
      }
    }
  } = useMidgardMayaContext()

  const { addressByChain$ } = useChainContext()
  const { getLedgerAddress$ } = useWalletContext()

  const INCLUDED_CHAINS = useMemo(() => getChainsForDex(protocol), [protocol])

  const [allSharesRD, setAllSharesRD] = useState<RD.RemoteData<Error, PoolShares>>(RD.initial)

  useEffect(() => {
    const subscription = userChains$
      .pipe(
        RxOp.switchMap((enabledChains) => {
          const addresses$: WalletAddress$[] = FP.pipe(
            enabledChains,
            A.filter((chain) => INCLUDED_CHAINS.includes(chain)),
            A.map(addressByChain$)
          )
          const ledgerAddresses$ = (): WalletAddress$[] =>
            FP.pipe(
              enabledChains,
              A.filter((chain) => INCLUDED_CHAINS.includes(chain)),
              A.map((chain) => getLedgerAddress$(chain)),
              A.map(RxOp.map(FP.flow(O.map(ledgerAddressToWalletAddress))))
            )
          const combinedAddresses$ = Rx.combineLatest([...addresses$, ...ledgerAddresses$()])

          return FP.pipe(
            combinedAddresses$,
            RxOp.switchMap(
              FP.flow(A.filterMap(FP.identity), A.map(addressFromWalletAddress), (addresses) =>
                protocol === THORChain ? allSharesByAddresses$(addresses) : allSharesByAddressesMaya$(addresses)
              )
            ),
            RxOp.startWith(RD.pending)
          )
        })
      )
      .subscribe(setAllSharesRD)

    return () => subscription.unsubscribe()
  }, [protocol, allSharesByAddresses$, allSharesByAddressesMaya$, addressByChain$, INCLUDED_CHAINS, getLedgerAddress$])

  const reload = useCallback(() => {
    if (protocol === THORChain) {
      reloadAllPools()
      reloadAllSharesByAddresses()
    } else {
      reloadAllMayaPools()
      reloadAllSharesByAddressesMaya()
    }
  }, [protocol, reloadAllMayaPools, reloadAllPools, reloadAllSharesByAddresses, reloadAllSharesByAddressesMaya])

  return {
    allSharesRD,
    reload
  }
}
