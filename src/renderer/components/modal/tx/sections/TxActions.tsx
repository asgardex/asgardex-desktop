import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { TxHash } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../services/clients'
import { ApiError } from '../../../../services/wallet/types'
import { Button, ButtonProps } from '../../../uielements/button'
import { ViewTxButton } from '../../../uielements/button'

type Props = {
  txRD: RD.RemoteData<ApiError, boolean>
  txHash: O.Option<TxHash>
  getExplorerTxUrl: GetExplorerTxUrl
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
  getExplorerTxUrl,
  openExplorerTxUrl,
  network,
  trackable = false,
  protocol = O.none,
  channelId = O.none,
  onClose,
  onFinish
}: Props): JSX.Element => {
  const intl = useIntl()

  const buttonProps: ButtonProps = useMemo(() => {
    const defaultProps: ButtonProps = {
      color: 'primary',
      disabled: false,
      onClick: onClose,
      sizevalue: 'xnormal',
      round: 'true',
      children: <>{intl.formatMessage({ id: 'common.finish' })}</>
    }

    return FP.pipe(
      txRD,
      RD.fold<ApiError, boolean, ButtonProps>(
        () => ({ ...defaultProps, disabled: true }),
        () => ({ ...defaultProps, disabled: true }),
        () => ({ ...defaultProps, children: intl.formatMessage({ id: 'common.finish' }) }),
        () => ({ ...defaultProps, onClick: onFinish })
      )
    )
  }, [intl, onClose, onFinish, txRD])

  const showViewTx = (RD.isSuccess(txRD) || RD.isFailure(txRD)) && O.isSome(txHash)

  return (
    <div className="flex flex-col items-center justify-center">
      <Button {...buttonProps} className="mt-6 h-10 w-[300px]" />
      {showViewTx && (
        <div className="flex items-center justify-center pt-6">
          <ViewTxButton
            txHash={txHash}
            onClick={openExplorerTxUrl}
            txUrl={FP.pipe(txHash, O.chain(getExplorerTxUrl))}
            network={network}
            trackable={trackable}
            protocol={protocol}
            channelId={channelId}
          />
        </div>
      )}
    </div>
  )
}
