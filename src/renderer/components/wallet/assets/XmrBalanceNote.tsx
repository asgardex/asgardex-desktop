import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { XMRChain } from '../../../../shared/utils/chainIds'
import { xmrBalanceInfo$, XmrBalanceInfo } from '../../../services/monero/balanceSource'
import { xmrRejectedCount$, xmrScanStatus$, XmrScanStatus } from '../../../services/monero/scanner'

const PICO = BigInt(1_000_000_000_000)

/** piconero -> "1.234567890123" (all 12 decimals, no float math) */
export const formatPiconero = (value: bigint): string => {
  const whole = value / PICO
  const fraction = (value % PICO).toString().padStart(12, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

/**
 * What the XMR balance means. With view-only keys outgoing spends are invisible, so the number is "total received".
 * Shown wherever an XMR balance is shown (asset list, asset details). It also shows
 * - outputs which were not counted (their amount could not be verified),
 * - spends reported by a light-wallet server on a separate, unverified line (never subtracted),
 * - a failed scan (window too large).
 */
export const XmrBalanceNoteView = ({
  info,
  scanStatus,
  rejectedCount = 0
}: {
  info: XmrBalanceInfo
  scanStatus: XmrScanStatus
  rejectedCount?: number
}): JSX.Element => {
  const intl = useIntl()
  return (
    <div className="flex flex-col items-end" data-testid="xmr-balance-note">
      <div className="text-[12px] text-warning0" data-testid="xmr-balance-source">
        {intl.formatMessage({ id: info.source === 'lws' ? 'monero.balance.lws' : 'monero.balance.received' })}
      </div>
      {info.source === 'lws' && info.serverReportedSpent !== undefined && (
        <div className="text-[12px] text-warning0" data-testid="xmr-server-spends">
          {intl.formatMessage(
            { id: 'monero.balance.serverSpends' },
            { amount: formatPiconero(info.serverReportedSpent) }
          )}
        </div>
      )}
      {info.source === 'local-scan' && rejectedCount > 0 && (
        <p className="mt-1 flex items-start text-[12px] text-error0" role="alert" data-testid="xmr-rejected">
          <ExclamationTriangleIcon className="mt-[2px] mr-1 h-4 w-4 shrink-0" />
          {intl.formatMessage({ id: 'monero.balance.rejected' }, { count: rejectedCount })}
        </p>
      )}
      {scanStatus.kind === 'range-too-large' && (
        <p className="mt-1 flex items-start text-[12px] text-error0" role="alert" data-testid="xmr-scan-range">
          <ExclamationTriangleIcon className="mt-[2px] mr-1 h-4 w-4 shrink-0" />
          {intl.formatMessage(
            { id: 'monero.scan.rangeTooLarge' },
            { gap: scanStatus.gap.toLocaleString('en-US'), limit: scanStatus.limit.toLocaleString('en-US') }
          )}
        </p>
      )}
    </div>
  )
}

/** Connected note; renders nothing for other chains */
export const XmrBalanceNote = ({ chain }: { chain: string }): JSX.Element | null => {
  const info = useObservableState(xmrBalanceInfo$, { source: 'local-scan' } as XmrBalanceInfo)
  const scanStatus = useObservableState(xmrScanStatus$, { kind: 'idle' } as XmrScanStatus)
  const rejectedCount = useObservableState(xmrRejectedCount$, 0)
  if (chain !== XMRChain) return null
  return <XmrBalanceNoteView info={info} scanStatus={scanStatus} rejectedCount={rejectedCount} />
}
