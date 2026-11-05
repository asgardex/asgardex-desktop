import { observableState } from '../../helpers/stateHelper'

/**
 * Where the XMR balance shown in the UI comes from. View-only keys cannot see outgoing spends (key images need the
 * private spend key), so the UI has to say what the number means:
 * - `received`: total received by the own address; spends are not tracked (local scan, or an LWS without spends).
 * - `lws-reported`: received minus the spends reported by the confirmed light-wallet server (not verifiable here).
 */
export type XmrBalanceSource = 'received' | 'lws-reported'

const { get$: xmrBalanceSource$, set: setXmrBalanceSource } = observableState<XmrBalanceSource>('received')

export { xmrBalanceSource$, setXmrBalanceSource }
