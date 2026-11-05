import { observableState } from '../../helpers/stateHelper'

/**
 * What the XMR balance shown in the UI means. View-only keys cannot see outgoing spends (key images need the private
 * spend key), so the balance is always "received" and the UI says so:
 * - `local-scan`: received outputs found by the local scan, amounts verified against their commitments.
 * - `lws`: received amount as reported by the confirmed light-wallet server (unverified).
 *
 * `serverReportedSpent` is what an LWS claims was spent. It is NEVER subtracted (the server cannot tell spends from
 * decoys); the UI shows it on a separate, clearly labelled line.
 */
export type XmrBalanceSource = 'local-scan' | 'lws'

export type XmrBalanceInfo = {
  source: XmrBalanceSource
  /** piconero; only with `source: 'lws'` and when the server reported `total_sent` */
  serverReportedSpent?: bigint
}

const { get$: xmrBalanceInfo$, set: setXmrBalanceInfo } = observableState<XmrBalanceInfo>({ source: 'local-scan' })

export { xmrBalanceInfo$, setXmrBalanceInfo }
