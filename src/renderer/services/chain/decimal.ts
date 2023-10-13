import * as RD from '@devexperts/remote-data-ts'
import { AVAXChain, AVAX_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-avax'
import { BNBChain } from '@xchainjs/xchain-binance'
import { BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL } from '@xchainjs/xchain-bitcoincash'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { COSMOS_DECIMAL } from '@xchainjs/xchain-cosmos'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DOGE_DECIMAL } from '@xchainjs/xchain-doge'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain, ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'
import { LTC_DECIMAL } from '@xchainjs/xchain-litecoin'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { Asset } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isEnabledChain } from '../../../shared/utils/chain'
import { BNB_DECIMAL, THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
// import { getERC20Decimal } from '../ethereum/common'
import { AssetWithDecimalLD } from './types'

const getDecimal = (asset: Asset): Promise<number> => {
  const { chain } = asset.synth ? AssetRuneNative : asset

  if (!isEnabledChain(chain)) return Promise.reject(`${chain} is not supported for 'getDecimal'`)

  switch (chain) {
    case BNBChain:
      return Promise.resolve(BNB_DECIMAL)
    case BTCChain:
      return Promise.resolve(BTC_DECIMAL)
    case ETHChain:
      return Promise.resolve(ETH_GAS_ASSET_DECIMAL)
    case AVAXChain:
      return Promise.resolve(AVAX_GAS_ASSET_DECIMAL)
    case THORChain:
      return Promise.resolve(THORCHAIN_DECIMAL)
    case DOGEChain:
      return Promise.resolve(DOGE_DECIMAL)
    case GAIAChain:
      return Promise.resolve(COSMOS_DECIMAL)
    case BCHChain:
      return Promise.resolve(BCH_DECIMAL)
    case LTCChain:
      return Promise.resolve(LTC_DECIMAL)
  }
}

export const assetWithDecimal$ = (asset: Asset): AssetWithDecimalLD =>
  Rx.from(getDecimal(asset)).pipe(
    RxOp.map((decimal) =>
      RD.success({
        asset,
        decimal
      })
    ),
    RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
    RxOp.startWith(RD.pending)
  )
