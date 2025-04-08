import { Chain } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { isSupportedChain } from '../../../shared/utils/chain'
import { WalletAddress$ } from '../clients'
import { getAddress$ } from '../xchainjs-wallet/wallet'

/**
 * Returns keystore addresses by given chain
 */
const addressByChain$ = (chain: Chain): WalletAddress$ => {
  if (!isSupportedChain(chain)) return Rx.of(O.none)

  return getAddress$(chain)
}

/**
 * Users wallet address for selected pool asset
 */
const assetAddress$ = (chain: Chain): WalletAddress$ => addressByChain$(chain)

export { assetAddress$, addressByChain$ }
