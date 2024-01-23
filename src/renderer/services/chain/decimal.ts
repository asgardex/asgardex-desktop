import * as RD from '@devexperts/remote-data-ts'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { DASH_DECIMAL } from '@xchainjs/xchain-dash'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { MidgardQuery } from '@xchainjs/xchain-midgard-query'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { Asset } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isEnabledChain } from '../../../shared/utils/chain'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { isBscChain, isDashChain, isMayaChain, isThorChain } from '../../helpers/chainHelper'
import { AssetWithDecimalLD } from './types'

// gets asset decimal from midgard-query
const getDecimal = (asset: Asset): Promise<number> => {
  const { chain } = asset.synth ? AssetRuneNative : asset

  if (!isEnabledChain(chain)) {
    return Promise.reject(new Error(`${chain} is not supported for 'getDecimal'`))
  }
  // @St0rmzy find out why bsc.bnb on midgard -1 instead of being the correct decimals.
  if (isBscChain(chain)) {
    return Promise.resolve(BSC_GAS_ASSET_DECIMAL)
  }
  // @St0rmzy find out why bsc.bnb on midgard -1 instead of being the correct decimals.
  if (isThorChain(chain)) {
    return Promise.resolve(THORCHAIN_DECIMAL)
  }
  if (isMayaChain(chain)) {
    return Promise.resolve(CACAO_DECIMAL)
  }

  if (isDashChain(chain)) {
    return Promise.resolve(DASH_DECIMAL)
  }

  const midgardQuery = new MidgardQuery()

  return Rx.from(midgardQuery.getDecimalForAsset(asset)).toPromise()
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
