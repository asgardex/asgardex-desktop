import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { TxHash } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { logger } from '../../../../helpers/logger'
import { OpenExplorerTxUrl } from '../../../../services/clients'
import { ApiError } from '../../../../services/wallet/types'
import { CopyLabel } from '../../../uielements/label'

type Props = {
  txRD: RD.RemoteData<ApiError, boolean>
  txHash: O.Option<TxHash>
  openExplorerTxUrl: OpenExplorerTxUrl
  network?: string
  trackable?: boolean
  protocol?: O.Option<string>
  channelId?: O.Option<string>
  onClose: FP.Lazy<void>
  onFinish: FP.Lazy<void>
}

export const TxActions = ({
  txRD,
  txHash,
  openExplorerTxUrl,
  network,
  trackable = false,
  protocol = O.none,
  channelId = O.none,
  onClose,
  onFinish
}: Props): JSX.Element => {
  const intl = useIntl()

  const isComplete = RD.isSuccess(txRD) || RD.isFailure(txRD)
  const isDisabled = RD.isInitial(txRD) || RD.isPending(txRD)
  const hasTxHash = O.isSome(txHash)

  const handleFinish = useMemo(() => (RD.isSuccess(txRD) ? onFinish : onClose), [txRD, onFinish, onClose])

  const handleViewExplorer = useCallback(() => {
    FP.pipe(txHash, O.fold(FP.constUndefined, openExplorerTxUrl))
  }, [txHash, openExplorerTxUrl])

  const handleTrack = useCallback(() => {
    FP.pipe(
      sequenceTOption(protocol, txHash),
      O.fold(
        () => undefined,
        ([protocolValue, hash]) => {
          let url: string | undefined
          switch (protocolValue) {
            case 'Thorchain':
              url = `https://track.thorchain.org/${hash}?logo=asgardex.png&network=${network || 'default'}`
              break
            case 'Mayachain':
              url = `https://www.xscanner.org/tx/${hash}`
              break
            case 'Chainflip':
              return FP.pipe(
                channelId,
                O.fold(
                  () => {
                    logger.warn('Channel ID required for Chainflip tracking')
                    return undefined
                  },
                  (id) => {
                    window.apiUrl.openExternal(`https://scan.chainflip.io/channels/${id}`)
                    return undefined
                  }
                )
              )
            default:
              return undefined
          }
          if (url) window.apiUrl.openExternal(url)
          return undefined
        }
      )
    )
  }, [protocol, txHash, network, channelId])

  const txHashStr = FP.pipe(
    txHash,
    O.getOrElse(() => '')
  )

  return (
    <div className="flex flex-col gap-3 px-6 pt-5 pb-2">
      {/* Button row */}
      <div className="flex gap-2">
        {/* Finish — always shown */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleFinish}
          className="flex-1 rounded-lg bg-turquoise py-2.5 font-main text-sm text-white uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          {intl.formatMessage({ id: 'common.finish' })}
        </button>

        {/* Track — shown for trackable swaps when tx is available */}
        {trackable && isComplete && hasTxHash && (
          <button
            type="button"
            onClick={handleTrack}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-turquoise px-4 py-2.5 font-main text-sm text-turquoise uppercase transition-opacity hover:opacity-80">
            {intl.formatMessage({ id: 'common.trackTransaction' })}
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Footer links — only when tx hash is available */}
      {isComplete && hasTxHash && (
        <div className="flex items-center justify-between border-t border-gray0 pt-3 dark:border-gray0d">
          <button
            type="button"
            onClick={handleViewExplorer}
            className="flex items-center gap-1 font-main text-xs text-text2 transition-colors hover:text-turquoise dark:text-text2d dark:hover:text-turquoise">
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            {intl.formatMessage({ id: 'common.viewTransaction' })}
          </button>
          <CopyLabel textToCopy={txHashStr} label={`${txHashStr.slice(0, 8)}...`} className="text-xs" />
        </div>
      )}
    </div>
  )
}
