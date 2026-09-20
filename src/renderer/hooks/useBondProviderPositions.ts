import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { NodeInfo } from '../services/thorchain/types'
import { BondProviderPosition, BondWalletInfo } from '../views/bonds/types'

/** last value replayed synchronously by a shared stream, `initial` otherwise */
const currentValue = <T>(observable: Rx.Observable<T>, initial: T): T => {
  let value = initial
  const subscription = observable.subscribe((next) => {
    value = next
  })
  subscription.unsubscribe()
  return value
}

type UseBondProviderPositionsParams = {
  addressesFetched: boolean
  thorWalletAddresses: BondWalletInfo[]
  getNodeInfos$: Rx.Observable<RD.RemoteData<Error, NodeInfo[]>>
}

/**
 * Positions of the connected wallet as bond provider — one position per
 * (node, wallet address) pair. Nodes that merely whitelisted an address
 * (bond = 0) are included, so users can bond right after being whitelisted.
 */
export const useBondProviderPositions = ({
  addressesFetched,
  thorWalletAddresses,
  getNodeInfos$
}: UseBondProviderPositionsParams): RD.RemoteData<Error, BondProviderPosition[]> => {
  const walletByAddress = useMemo(() => {
    const map = new Map<string, BondWalletInfo>()
    thorWalletAddresses.forEach((info) => {
      const key = info.address.toLowerCase()
      // prefer the first entry (keystore comes first in balances)
      if (!map.has(key)) map.set(key, info)
    })
    return map
  }, [thorWalletAddresses])

  const positions$ = useMemo(() => {
    if (!addressesFetched) return Rx.of(RD.initial)

    return FP.pipe(
      getNodeInfos$,
      RxOp.map((nodeInfosRD) =>
        FP.pipe(
          nodeInfosRD,
          RD.map((nodes: NodeInfo[]) =>
            FP.pipe(
              nodes,
              A.chain((node) =>
                FP.pipe(
                  node.bondProviders.providers,
                  A.filterMap((provider) => {
                    const signer = walletByAddress.get(provider.bondAddress.toLowerCase())
                    if (!signer) return O.none
                    return O.some<BondProviderPosition>({
                      nodeAddress: node.address,
                      status: node.status,
                      signMembership: node.signMembership,
                      myBond: provider.bond,
                      nodeBond: node.bond,
                      nodeOperatorFee: node.bondProviders.nodeOperatorFee,
                      providers: node.bondProviders.providers,
                      signer
                    })
                  })
                )
              )
            )
          )
        )
      ),
      RxOp.startWith(RD.initial),
      RxOp.shareReplay(1)
    )
  }, [addressesFetched, getNodeInfos$, walletByAddress])

  // start from the replayed value so a remount renders the data right away
  const [positions, setPositions] = useState<RD.RemoteData<Error, BondProviderPosition[]>>(() =>
    currentValue(positions$, RD.initial)
  )

  useEffect(() => {
    const subscription = positions$.subscribe(setPositions)
    return () => subscription.unsubscribe()
  }, [positions$])

  return positions
}
