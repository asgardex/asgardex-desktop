import { AVAXChain } from '@xchainjs/xchain-avax'
import { BNBChain } from '@xchainjs/xchain-binance'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { isEnabledChain } from '../../../shared/utils/chain'
import * as AVAX from '../avax'
import * as BNB from '../binance'
import * as BTC from '../bitcoin'
import * as BCH from '../bitcoincash'
import * as BSC from '../bsc'
import { address$, WalletAddress$ } from '../clients'
import * as COSMOS from '../cosmos'
import * as DASH from '../dash'
import * as DOGE from '../doge'
import * as ETH from '../ethereum'
import * as LTC from '../litecoin'
import * as MAYA from '../mayachain'
import * as THOR from '../thorchain'
import { client$ } from './client'

/**
 * Returns keystore addresses by given chain
 */
const addressByChain$ = (chain: Chain): WalletAddress$ => {
  if (!isEnabledChain(chain)) return Rx.of(O.none)

  switch (chain) {
    case BNBChain:
      return BNB.address$
    case BTCChain:
      return BTC.address$
    case DASHChain:
      return DASH.address$
    case ETHChain:
      return ETH.address$
    case AVAXChain:
      return AVAX.address$
    case BSCChain:
      return BSC.address$
    case THORChain:
      return THOR.address$
    case MAYAChain:
      return MAYA.address$
    case GAIAChain:
      return COSMOS.address$
    case BCHChain:
      return BCH.address$
    case LTCChain:
      return LTC.address$
    case DOGEChain:
      return DOGE.address$
  }
}

/**
 * Users wallet address for selected pool asset
 */
const assetAddress$ = (chain: Chain): WalletAddress$ => address$(client$, chain)

export { assetAddress$, addressByChain$ }
