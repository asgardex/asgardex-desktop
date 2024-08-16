import * as RD from '@devexperts/remote-data-ts'
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
import { THORChain } from '@xchainjs/xchain-thorchain'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isSupportedChain } from '../../../shared/utils/chain'
import { isThorChain } from '../../helpers/chainHelper'
import { observableState } from '../../helpers/stateHelper'
import * as ARB from '../arb'
import * as AVAX from '../avax'
import * as BTC from '../bitcoin'
import * as BCH from '../bitcoincash'
import * as BSC from '../bsc'
import * as C from '../clients'
import { ExplorerUrl$, TxsPageLD, LoadTxsParams } from '../clients'
import * as COSMOS from '../cosmos'
import * as DASH from '../dash'
import * as DOGE from '../doge'
import * as ETH from '../ethereum'
import * as KUJI from '../kuji'
import * as LTC from '../litecoin'
import * as MAYA from '../mayachain'
import * as THOR from '../thorchain'
import { client$, selectedAsset$ } from './common'
import { INITIAL_LOAD_TXS_PROPS } from './const'
import { ApiError, ErrorId, LoadTxsHandler, ResetTxsPageHandler } from './types'

export const explorerUrl$: ExplorerUrl$ = C.explorerUrl$(client$)

/**
 * State of `LoadTxsProps`, which triggers reload of txs history
 */
const { get$: loadTxsProps$, set: setLoadTxsProps } = observableState<LoadTxsParams>(INITIAL_LOAD_TXS_PROPS)

export { setLoadTxsProps }

export const loadTxs: LoadTxsHandler = setLoadTxsProps

export const resetTxsPage: ResetTxsPageHandler = () => setLoadTxsProps(INITIAL_LOAD_TXS_PROPS)

/**
 * Factory create a stream of `TxsPageRD` based on selected asset
 */
export const getTxs$: (walletAddress: O.Option<string>, walletIndex: number) => TxsPageLD = (
  walletAddress = O.none,
  walletIndex
) =>
  Rx.combineLatest([selectedAsset$, loadTxsProps$]).pipe(
    RxOp.switchMap(([oAsset, { limit, offset }]) =>
      FP.pipe(
        oAsset,
        O.fold(
          () => Rx.of(RD.initial),
          ({ asset }) => {
            const { chain } = asset
            if (!isSupportedChain(chain) || asset.synth || isThorChain(chain)) {
              return Rx.of(RD.failure<ApiError>({ errorId: ErrorId.GET_ASSET_TXS, msg: `Unsupported chain ${chain}` }))
            }
            switch (chain) {
              case BTCChain:
                return BTC.txs$({ asset: O.none, limit, offset, walletAddress, walletIndex })
              case DASHChain:
                return DASH.txs$({ asset: O.none, limit, offset, walletAddress, walletIndex })
              case ETHChain:
                return ETH.txs$({ asset: O.some(asset), limit, offset, walletAddress, walletIndex })
              case ARBChain:
                return ARB.txs$({ asset: O.some(asset), limit, offset, walletAddress, walletIndex })
              case AVAXChain:
                return AVAX.txs$({ asset: O.some(asset), limit, offset, walletAddress, walletIndex })
              case BSCChain:
                return BSC.txs$({ asset: O.some(asset), limit, offset, walletAddress, walletIndex })
              case THORChain:
                return THOR.txs$({ asset: O.some(asset), walletAddress, walletIndex })
              case MAYAChain:
                return MAYA.txs$({ asset: O.none, walletAddress, walletIndex })
              case LTCChain:
                return LTC.txs$({ asset: O.none, limit, offset, walletAddress, walletIndex })
              case BCHChain:
                return BCH.txs$({ asset: O.none, limit, offset, walletAddress, walletIndex })
              case DOGEChain:
                return DOGE.txs$({ asset: O.none, limit, offset, walletAddress, walletIndex })
              case KUJIChain:
                return KUJI.txs$({ asset: O.none, walletAddress, walletIndex })
              case GAIAChain:
                return COSMOS.txs$({ asset: O.none, walletAddress, walletIndex })
              default:
                return Rx.of(
                  RD.failure<ApiError>({ errorId: ErrorId.GET_ASSET_TXS, msg: `Unsupported chain ${chain}` })
                )
            }
          }
        )
      )
    )
  )
