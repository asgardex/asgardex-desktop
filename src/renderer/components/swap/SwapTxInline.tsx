import { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { baseToAsset, isTradeAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { protocolMapping } from '../../helpers/protocolHelper'
import { hiddenString } from '../../helpers/stringHelper'
import type { OpenExplorerTxUrl } from '../../services/clients'
import type { TxHashRD } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'
import type { AssetData } from '../modal/tx/extra/Common.types'
import { openTrackedSwap, swapTrackVisible } from '../modal/tx/trackSwap'
import { CopyLabel } from '../uielements/label'
import { ProviderIcon } from './ProviderIcon'

type Side = 'buy' | 'sell'

type Props = {
  swapTx: TxHashRD
  source: AssetData
  target: AssetData
  protocol: O.Option<string>
  channelId: O.Option<string>
  txHash: O.Option<string>
  network: string
  side?: Side
  isOpeningChannel: boolean
  goToTransaction: OpenExplorerTxUrl
  onClose: () => void
  onFinish: () => void
}

const amountText = (amount: AssetData['amount']): string => {
  const text = baseToAsset(amount)
    .amount()
    .decimalPlaces(THORCHAIN_DECIMAL, BigNumber.ROUND_DOWN)
    .toFixed(THORCHAIN_DECIMAL)
    .replace(/\.?0+$/, '')
  return text === '' || text === '-' ? '0' : text
}

/** Compact swap receipt for the chart panel. Same row on L1 and trade charts. */
export const SwapTxInline = ({
  swapTx,
  source,
  target,
  protocol,
  channelId,
  txHash,
  network,
  side,
  isOpeningChannel,
  goToTransaction,
  onClose,
  onFinish
}: Props) => {
  const intl = useIntl()
  const { isPrivate } = useApp()
  const settled = RD.isSuccess(swapTx) || RD.isFailure(swapTx)
  const hasHash = O.isSome(txHash)
  const tradeAssetSwap = isTradeAsset(source.asset) && isTradeAsset(target.asset)
  const showTrack = swapTrackVisible({ tradeAssetSwap, protocol, channelId, hasHash, settled })
  const hash = FP.pipe(
    txHash,
    O.getOrElse(() => '')
  )
  const protocolName = FP.pipe(
    protocol,
    O.map((name) => protocolMapping[name as keyof typeof protocolMapping] ?? name),
    O.toUndefined
  )
  const errorMsg = FP.pipe(
    swapTx,
    RD.fold(
      () => '',
      () => '',
      (error) => error?.msg ?? '',
      () => ''
    )
  )

  const onFinishClick = useCallback(() => {
    if (RD.isSuccess(swapTx)) onFinish()
    else onClose()
  }, [onClose, onFinish, swapTx])

  const onView = useCallback(() => {
    FP.pipe(txHash, O.fold(FP.constUndefined, goToTransaction))
  }, [goToTransaction, txHash])

  const onTrack = useCallback(() => {
    openTrackedSwap(protocol, txHash, channelId, network)
  }, [channelId, network, protocol, txHash])

  const statusId = RD.isFailure(swapTx) ? 'common.error' : RD.isSuccess(swapTx) ? 'common.done' : 'swap.state.pending'
  const detail = isOpeningChannel ? intl.formatMessage({ id: 'swap.state.openingChannel' }) : errorMsg || protocolName

  return (
    <div
      className={clsx(
        'rounded-lg border px-2 py-2',
        RD.isFailure(swapTx) ? 'border-error0/40 bg-error0/10' : 'border-turquoise/30 bg-turquoise/10'
      )}>
      <div className="flex items-start gap-2">
        {side && (
          <span
            className={clsx(
              'mt-0.5 rounded px-1.5 py-0.5 font-main text-[10px] font-bold uppercase',
              side === 'buy' ? 'bg-turquoise/20 text-turquoise' : 'bg-error0/20 text-error0'
            )}>
            {intl.formatMessage({ id: side === 'buy' ? 'common.buy' : 'common.sell' })}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-main text-11 text-white">
            {isPrivate ? hiddenString : amountText(source.amount)} {source.asset.ticker}
            <span className="text-gray-500">
              {' '}
              → {isPrivate ? hiddenString : amountText(target.amount)} {target.asset.ticker}
            </span>
          </p>
          {(detail || hasHash) && (
            <div className="m-0 mt-0.5 flex min-w-0 items-center gap-1.5 font-main text-[10px] text-gray-500">
              {protocolName && !isOpeningChannel && !errorMsg && (
                <ProviderIcon
                  protocol={FP.pipe(
                    protocol,
                    O.getOrElse(() => '')
                  )}
                  className="!h-3.5 !w-3.5"
                />
              )}
              {detail && <span className="truncate">{detail}</span>}
              {hasHash && (
                <CopyLabel
                  textToCopy={hash}
                  label={`${hash.slice(0, 8)}...`}
                  className="shrink-0 text-[10px]"
                  iconClassName="!h-3 !w-3"
                />
              )}
            </div>
          )}
        </div>
        <span
          className={clsx(
            'mt-0.5 flex items-center gap-1 font-main text-[10px]',
            RD.isSuccess(swapTx) && 'text-success',
            RD.isFailure(swapTx) && 'text-error0',
            !settled && 'text-turquoise'
          )}>
          {!settled && (
            <span className="h-1.5 w-1.5 rounded-full bg-turquoise shadow-[0_0_0_3px_rgba(0,104,247,0.18)]" />
          )}
          {intl.formatMessage({ id: statusId })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={intl.formatMessage({ id: 'common.cancel' })}
          className="grid size-5 shrink-0 place-items-center text-gray-400 hover:text-white">
          <XMarkIcon className="size-3.5" />
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          disabled={!settled}
          onClick={onFinishClick}
          className="font-main text-11 text-turquoise disabled:cursor-not-allowed disabled:opacity-40">
          {intl.formatMessage({ id: 'common.finish' })}
        </button>
        {showTrack && (
          <button type="button" onClick={onTrack} className="font-main text-11 text-turquoise">
            {intl.formatMessage({ id: 'common.trackTransaction' })}
          </button>
        )}
        {settled && hasHash && (
          <button type="button" onClick={onView} className="font-main text-11 text-gray-400 hover:text-white">
            {intl.formatMessage({ id: 'common.viewTransaction' })}
          </button>
        )}
      </div>
    </div>
  )
}
