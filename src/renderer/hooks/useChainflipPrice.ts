import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'

import { useChainflipContext } from '../contexts/ChainflipContext'
import { xChainToCChain } from '../services/chainflip/utils'

type UseChainflipPriceResult = {
  priceRD: RD.RemoteData<Error, number>
  hasChainflip: boolean
}

const isChainflipSupported = (chain: string): boolean => {
  try {
    xChainToCChain(chain as Parameters<typeof xChainToCChain>[0])
    return true
  } catch {
    return false
  }
}

export const useChainflipPrice = (poolAsset: AnyAsset | null): UseChainflipPriceResult => {
  const { getQuotePrice$ } = useChainflipContext()

  const hasChainflip = useMemo(() => poolAsset !== null && isChainflipSupported(poolAsset.chain), [poolAsset])

  const price$ = useMemo(
    () => (poolAsset && hasChainflip ? getQuotePrice$(poolAsset) : Rx.of(RD.initial as RD.RemoteData<Error, number>)),
    [poolAsset, hasChainflip, getQuotePrice$]
  )

  const priceRD = useObservableState(price$, RD.initial as RD.RemoteData<Error, number>)

  return { priceRD, hasChainflip }
}
