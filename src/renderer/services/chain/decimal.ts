import * as RD from '@devexperts/remote-data-ts'
import { MidgardQuery } from '@xchainjs/xchain-midgard-query'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { Asset } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isEnabledChain } from '../../../shared/utils/chain'
import { AssetWithDecimalLD } from './types'
// gets asset decimal from midgard-query
const getDecimal = (asset: Asset): Promise<number> => {
  const { chain } = asset.synth ? AssetRuneNative : asset

  if (!isEnabledChain(chain)) {
    return Promise.reject(new Error(`${chain} is not supported for 'getDecimal'`))
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
