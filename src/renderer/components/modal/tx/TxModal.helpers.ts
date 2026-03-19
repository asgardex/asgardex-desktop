import * as RD from '@devexperts/remote-data-ts'
import { TxHash } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { IntlShape } from 'react-intl'

import { isEvmChain } from '../../../helpers/evmHelper'
import { ApiError, TxHashRD } from '../../../services/wallet/types'
import { AssetData } from './extra/Common.types'
import { TxConfig } from './TxModal.types'

/**
 * Extract timer value from a TxHashRD — shared across all consumers.
 * Initial/Failure → 0, Pending → loaded%, Success → 100
 */
export const getTxTimerValue = (rd: TxHashRD): number =>
  FP.pipe(
    rd,
    RD.fold(
      () => 0,
      FP.flow(
        O.map(({ loaded }) => loaded),
        O.getOrElse(() => 0)
      ),
      () => 0,
      () => 100
    )
  )

/**
 * Extract timer value from a boolean RD (deposit-style).
 */
export const getDepositTimerValue = (rd: RD.RemoteData<unknown, boolean>): number =>
  FP.pipe(
    rd,
    RD.fold(
      () => 0,
      FP.flow(
        O.map(({ loaded }) => loaded),
        O.getOrElse(() => 0)
      ),
      () => 0,
      () => 100
    )
  )

/**
 * Convert TxHashRD to RD<ApiError, boolean> for the modal.
 */
export const txHashRDToBoolean = (rd: TxHashRD): RD.RemoteData<ApiError, boolean> =>
  FP.pipe(
    rd,
    RD.map((txHash) => !!txHash)
  )

/**
 * Extract txHash from TxHashRD, optionally stripping 0x for EVM chains.
 */
export const extractTxHash = (rd: TxHashRD, chain?: string, protocol?: string): O.Option<TxHash> =>
  FP.pipe(
    RD.toOption(rd),
    O.map((txHash) => {
      if (chain && isEvmChain(chain) && protocol !== 'Chainflip') {
        return txHash.replace(/0x/i, '')
      }
      return txHash
    })
  )

/**
 * Build a swap TxConfig from source and target asset data.
 */
export const toSwapTxConfig = (
  source: AssetData,
  target: AssetData,
  protocol?: O.Option<string>,
  channelId?: O.Option<string>
): TxConfig => ({
  type: 'swap',
  source,
  target,
  protocol,
  channelId
})

/**
 * Build a send TxConfig.
 */
export const toSendTxConfig = (asset: AnyAsset, amount: BaseAmount): TxConfig => ({
  type: 'send',
  asset: { asset, amount }
})

/**
 * Build a deposit TxConfig with step tracking.
 */
export const toDepositTxConfig = (
  asset: AnyAsset,
  amount: BaseAmount,
  steps: { current: number; total: number },
  stepDescriptions: string[]
): TxConfig => ({
  type: 'deposit',
  asset: { asset, amount },
  steps,
  stepDescriptions
})

/**
 * Build an interact TxConfig.
 */
export const toInteractTxConfig = (asset: AnyAsset, amount: BaseAmount): TxConfig => ({
  type: 'interact',
  asset: { asset, amount }
})

/**
 * Derive title from TxConfig type (fallback when title is not provided).
 */
export const getTxTitle = (txConfig: TxConfig, intl: IntlShape): string => {
  switch (txConfig.type) {
    case 'swap':
      return intl.formatMessage({ id: 'common.tx.sending' })
    case 'send':
      return intl.formatMessage({ id: 'common.tx.sending' })
    case 'deposit':
    case 'symDeposit':
      return intl.formatMessage({ id: 'deposit.add.state.pending' })
    case 'interact':
      return intl.formatMessage({ id: 'common.tx.sending' })
    case 'withdraw':
    case 'claim':
      return intl.formatMessage({ id: 'common.tx.sending' })
  }
}
