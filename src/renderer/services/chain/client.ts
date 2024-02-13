import { AVAXChain } from '@xchainjs/xchain-avax'
import { BNBChain } from '@xchainjs/xchain-binance'
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
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, Chain } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isEnabledChain } from '../../../shared/utils/chain'
import * as AVAX from '../avax'
import * as BNB from '../binance'
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
import * as THOR from '../thorchain'
import type { Chain$ } from './types'

export const clientByChain$ = (chain: Chain): XChainClient$ => {
  if (!isEnabledChain(chain)) return Rx.of(O.none)

  switch (chain) {
    case BNBChain:
      return BNB.client$
    case BTCChain:
      return BTC.client$
    case DASHChain:
      return DASH.client$
    case BCHChain:
      return BCH.client$
    case ETHChain:
      return ETH.client$
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
  }
}
// mayachainSwap
export const clientByAsset$ = (asset: Asset): XChainClient$ => {
  const chain = asset.chain
  if (!isEnabledChain(chain)) return Rx.of(O.none)
  switch (chain) {
    case BNBChain:
      return asset.synth ? THOR.client$ : BNB.client$
    case BTCChain:
      return asset.synth ? THOR.client$ : BTC.client$
    case DASHChain:
      return asset.synth ? MAYA.client$ : DASH.client$
    case BCHChain:
      return asset.synth ? THOR.client$ : BCH.client$
    case ETHChain:
      return asset.synth ? THOR.client$ : ETH.client$
    case AVAXChain:
      return asset.synth ? THOR.client$ : AVAX.client$
    case BSCChain:
      return asset.synth ? THOR.client$ : BSC.client$
    case THORChain:
      return THOR.client$
    case MAYAChain:
      return MAYA.client$
    case LTCChain:
      return asset.synth ? THOR.client$ : LTC.client$
    case DOGEChain:
      return asset.synth ? THOR.client$ : DOGE.client$
    case GAIAChain:
      return asset.synth ? THOR.client$ : COSMOS.client$
    case KUJIChain:
      return asset.synth ? MAYA.client$ : KUJI.client$
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
