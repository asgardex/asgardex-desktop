import * as RD from '@devexperts/remote-data-ts'
import { Network, Tx, TxType, TxsPage } from '@xchainjs/xchain-client'
import { Configuration as MayaMidgardConfiguration, MidgardApi as MayaMidgardApi } from '@xchainjs/xchain-mayamidgard'
import { Configuration as ThorMidgardConfiguration, MidgardApi as ThorMidgardApi } from '@xchainjs/xchain-midgard'
import { AnyAsset, assetFromString, baseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { DEFAULT_MIDGARD_MAYA_URLS } from '../../../../shared/mayaMidgard/const'
import { DEFAULT_MIDGARD_URLS } from '../../../../shared/midgard/const'
import { resolveMidgardUrl } from '../../../../shared/thorchain/const'
import { logger } from '../../../helpers/logger'
import { network$ } from '../../app/service'
import { midgard$, midgardMaya$ } from '../../storage/common'
import { ApiError, ErrorId } from '../../wallet/types'
import { TxsPageLD, TxsParams } from '../types'

type MidgardProtocol = 'thor' | 'maya'

/**
 * xchain cosmos `getTransactions` uses CometBFT `tx_search` + `txSearchAll`, which:
 * - pages through *every* matching tx (thousands of RPC calls for active wallets)
 * - often times out / 500s on Liquify for `message.sender`
 * - floods the console with failed RPC/API retries
 *
 * Midgard `/v2/actions` is the correct history source for THOR/MAYA and supports limit/offset.
 */
const loadMidgardTxsPage = async ({
  protocol,
  basePath,
  address,
  limit,
  offset,
  chainAsset
}: {
  protocol: MidgardProtocol
  basePath: string
  address: string
  limit: number
  offset: number
  chainAsset: AnyAsset
}): Promise<TxsPage> => {
  // THOR Midgard: address, txid, asset, type, txType, affiliate, limit, offset
  // Maya Midgard: address, txid, asset, type, affiliate, limit, offset  (no txType)
  // Passing the THOR shape into Maya shifts limit/offset and skips the newest page.
  const response =
    protocol === 'thor'
      ? await new ThorMidgardApi(new ThorMidgardConfiguration({ basePath })).getActions(
          address,
          undefined, // txid
          undefined, // asset
          undefined, // type
          undefined, // txType
          undefined, // affiliate
          limit,
          offset
        )
      : await new MayaMidgardApi(new MayaMidgardConfiguration({ basePath })).getActions(
          address,
          undefined, // txid
          undefined, // asset
          undefined, // type
          undefined, // affiliate
          limit,
          offset
        )

  const data = 'data' in response ? response.data : response
  const actions = data.actions ?? []
  const total = parseInt(data.count || '0', 10)

  const txs: Tx[] = []

  for (const action of actions) {
    const date = new Date(Number(action.date) / 1_000_000) // ns → ms
    const ins = action.in ?? []
    const outs = action.out ?? []

    // Prefer the first non-empty tx id from inbound, then outbound
    const hash =
      ins
        .map((t) => t.txID)
        .find((id) => !!id && id !== '0000000000000000000000000000000000000000000000000000000000000000') ||
      outs
        .map((t) => t.txID)
        .find((id) => !!id && id !== '0000000000000000000000000000000000000000000000000000000000000000') ||
      ''

    const from = ins.flatMap((tx) =>
      (tx.coins ?? []).map((coin) => {
        const asset = assetFromString(coin.asset) ?? chainAsset
        return {
          from: tx.address || address,
          amount: baseAmount(coin.amount),
          asset
        }
      })
    )

    const to = outs.flatMap((tx) =>
      (tx.coins ?? []).map((coin) => {
        const asset = assetFromString(coin.asset) ?? chainAsset
        return {
          to: tx.address || '',
          amount: baseAmount(coin.amount),
          asset
        }
      })
    )

    // Skip empty shell actions
    if (!from.length && !to.length) continue

    txs.push({
      asset: chainAsset,
      from: from.length
        ? from
        : [
            {
              from: address,
              amount: baseAmount(0)
            }
          ],
      to: to.length
        ? to
        : [
            {
              to: address,
              amount: baseAmount(0)
            }
          ],
      date,
      type: TxType.Transfer,
      hash
    })
  }

  return { total: Number.isFinite(total) ? total : txs.length, txs }
}

const midgardBaseUrl$ = (protocol: MidgardProtocol): Rx.Observable<string> =>
  Rx.combineLatest([protocol === 'thor' ? midgard$ : midgardMaya$, network$]).pipe(
    RxOp.map(([urls, network]) => {
      const defaults = protocol === 'thor' ? DEFAULT_MIDGARD_URLS : DEFAULT_MIDGARD_MAYA_URLS
      const configured = urls[network as Network] || defaults[network as Network] || defaults.mainnet
      return protocol === 'thor' ? resolveMidgardUrl(configured, network as Network) : configured
    }),
    RxOp.distinctUntilChanged()
  )

/**
 * Load paginated THOR/MAYA wallet txs via Midgard (not CometBFT tx_search).
 */
export const midgardTxs$ =
  (protocol: MidgardProtocol, chainAsset: AnyAsset) =>
  ({ limit = 10, offset = 0, walletAddress, walletIndex: _walletIndex }: TxsParams): TxsPageLD => {
    const address$ = FP.pipe(
      walletAddress,
      O.fold(
        () => Rx.of(RD.failure<ApiError>({ errorId: ErrorId.GET_ASSET_TXS, msg: 'Missing wallet address' })),
        (address) =>
          midgardBaseUrl$(protocol).pipe(
            RxOp.switchMap((basePath) =>
              Rx.from(
                loadMidgardTxsPage({
                  protocol,
                  basePath,
                  address,
                  limit,
                  offset,
                  chainAsset
                })
              ).pipe(
                RxOp.map(RD.success),
                RxOp.catchError((error: Error) => {
                  logger.error(`${protocol} midgard getActions history error:`, error)
                  return Rx.of(
                    RD.failure<ApiError>({
                      errorId: ErrorId.GET_ASSET_TXS,
                      msg: error?.message ?? error.toString()
                    })
                  )
                }),
                RxOp.startWith(RD.pending)
              )
            )
          )
      )
    )

    return address$
  }
