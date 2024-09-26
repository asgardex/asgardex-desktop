import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, AssetType, Chain } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../../shared/api/types'
import { isSupportedChain } from '../../../shared/utils/chain'
import * as ARB from '../arb'
import * as AVAX from '../avax'
import * as BTC from '../bitcoin'
import * as BCH from '../bitcoincash'
import * as BSC from '../bsc'
import { XChainClient$ } from '../clients'
import * as COSMOS from '../cosmos'
import * as DASH from '../dash'
import * as DOGE from '../doge'
import * as ETH from '../ethereum'
import * as KUJI from '../kuji'
import * as LTC from '../litecoin'
import * as MAYA from '../mayachain'
import { selectedPoolChain$ } from '../midgard/common'
import * as XRD from '../radix'
import * as THOR from '../thorchain'
import type { Chain$ } from './types'

export const clientByChain$ = (chain: Chain): XChainClient$ => {
  if (!isSupportedChain(chain)) return Rx.of(O.none)

  switch (chain) {
    case BTCChain:
      return BTC.client$
    case DASHChain:
      return DASH.client$
    case BCHChain:
      return BCH.client$
    case ETHChain:
      return ETH.client$
    case ARBChain:
      return ARB.client$
    case AVAXChain:
      return AVAX.client$
    case BSCChain:
      return BSC.client$
    case THORChain:
      return THOR.client$
    case MAYAChain:
      return MAYA.client$
    case LTCChain:
      return LTC.client$
    case DOGEChain:
      return DOGE.client$
    case GAIAChain:
      return COSMOS.client$
    case KUJIChain:
      return KUJI.client$
    case RadixChain:
      return XRD.client$
    default:
      return Rx.of(O.none) // Add a default case to handle unsupported chains
  }
}

export const clientByAsset$ = (asset: AnyAsset, dex: Dex): XChainClient$ => {
  const chain = asset.chain
  if (!isSupportedChain(chain)) return Rx.of(O.none)

  // If the asset is synthetic, use the respective client based on dex.chain
  if (asset.type === AssetType.SYNTH) {
    if (dex.chain === THORChain) return THOR.client$
    if (dex.chain === MAYAChain) return MAYA.client$
  }

  switch (chain) {
    case BTCChain:
      return BTC.client$
    case DASHChain:
      return DASH.client$
    case BCHChain:
      return BCH.client$
    case ETHChain:
      return ETH.client$
    case ARBChain:
      return ARB.client$
    case AVAXChain:
      return AVAX.client$
    case BSCChain:
      return BSC.client$
    case THORChain:
      return THOR.client$
    case MAYAChain:
      return MAYA.client$
    case LTCChain:
      return LTC.client$
    case DOGEChain:
      return DOGE.client$
    case GAIAChain:
      return COSMOS.client$
    case KUJIChain:
      return KUJI.client$
    case RadixChain:
      return XRD.client$
    default:
      return Rx.of(O.none) // Add a default case to handle unsupported chains
  }
}

export const getClientByChain$: (chain$: Chain$) => XChainClient$ = (chain$) =>
  chain$.pipe(
    RxOp.switchMap(
      O.fold(
        () => Rx.EMPTY,
        (chain) => clientByChain$(chain)
      )
    )
  )

/**
 * Client depending on selected pool chain
 */
export const client$ = getClientByChain$(selectedPoolChain$)
