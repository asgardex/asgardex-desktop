import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useObservableEagerState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { NodeInfo } from '../services/thorchain/types'
import { BondProviderPosition, BondWalletInfo } from '../views/bonds/types'

type UseBondProviderPositionsParams = {
  addressesFetched: boolean
  thorWalletAddresses: BondWalletInfo[]
  getNodeInfos$: Rx.Observable<RD.RemoteData<Error, NodeInfo[]>>
}

export const useBondProviderPositions = ({
  addressesFetched,
  thorWalletAddresses,
  getNodeInfos$
}: UseBondProviderPositionsParams): RD.RemoteData<Error, BondProviderPosition[]> => {
  const walletByAddress = useMemo(() => {
    const map = new Map<string, BondWalletInfo>()
    thorWalletAddresses.forEach((info) => {
      const key = info.address.toLowerCase()
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

  return useObservableEagerState(positions$)
}
