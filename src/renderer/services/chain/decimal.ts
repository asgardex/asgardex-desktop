import * as RD from '@devexperts/remote-data-ts'
import { ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL } from '@xchainjs/xchain-bitcoincash'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { DASH_DECIMAL } from '@xchainjs/xchain-dash'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { MidgardQuery } from '@xchainjs/xchain-midgard-query'
import { XRD_DECIMAL } from '@xchainjs/xchain-radix'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { AnyAsset, AssetType } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import {
  isArbChain,
  isBchChain,
  isBscChain,
  isBtcChain,
  isDashChain,
  isKujiChain,
  isMayaChain,
  isThorChain,
  isXrdChain
} from '../../helpers/chainHelper'
import { KUJI_DECIMAL } from '../kuji/const'
import { AssetWithDecimalLD } from './types'

// gets asset decimal from midgard-query tobefixed
const getDecimal = (asset: AnyAsset): Promise<number> => {
  const { chain } = asset.type === AssetType.SYNTH ? AssetRuneNative : asset

  if (isArbChain(chain)) {
    return Promise.resolve(ARB_GAS_ASSET_DECIMAL)
  }
  // @St0rmzy find out why bsc.bnb on midgard -1 instead of being the correct decimals.
  if (isBscChain(chain)) {
    return Promise.resolve(BSC_GAS_ASSET_DECIMAL)
  }

  if (isThorChain(chain)) {
    return Promise.resolve(THORCHAIN_DECIMAL)
  }
  if (isMayaChain(chain)) {
    return Promise.resolve(CACAO_DECIMAL)
  }
  if (isDashChain(chain)) {
    return Promise.resolve(DASH_DECIMAL)
  }
  if (isKujiChain(chain)) {
    return Promise.resolve(KUJI_DECIMAL)
  }
  if (isXrdChain(chain)) {
    return Promise.resolve(XRD_DECIMAL)
  }
  if (isBtcChain(chain)) {
    return Promise.resolve(BTC_DECIMAL)
  }
  if (isBchChain(chain)) {
    return Promise.resolve(BCH_DECIMAL)
  }

  const midgardQuery = new MidgardQuery()

  return Rx.from(midgardQuery.getDecimalForAsset(asset)).toPromise()
}

export const assetWithDecimal$ = (asset: AnyAsset): AssetWithDecimalLD =>
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
