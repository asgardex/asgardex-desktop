import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { XMRChain } from '../../../../shared/utils/chainIds'
import { xmrBalanceSource$, XmrBalanceSource } from '../../../services/monero/balanceSource'
import { xmrScanStatus$, XmrScanStatus } from '../../../services/monero/scanner'

/**
 * What the XMR balance means. With view-only keys outgoing spends are invisible, so the number is "total received".
 * Shown wherever an XMR balance is shown (asset list, asset details). Also explains a failed scan (window too large).
 */
export const XmrBalanceNoteView = ({
  source,
  scanStatus
}: {
  source: XmrBalanceSource
  scanStatus: XmrScanStatus
}): JSX.Element => {
  const intl = useIntl()
  return (
    <div className="flex flex-col items-end" data-testid="xmr-balance-note">
      <div className="text-[12px] text-warning0" data-testid="xmr-balance-source">
        {intl.formatMessage({ id: source === 'lws-reported' ? 'monero.balance.lws' : 'monero.balance.received' })}
      </div>
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
  const source = useObservableState(xmrBalanceSource$, 'received')
  const scanStatus = useObservableState(xmrScanStatus$, { kind: 'idle' } as XmrScanStatus)
  if (chain !== XMRChain) return null
  return <XmrBalanceNoteView source={source} scanStatus={scanStatus} />
}
