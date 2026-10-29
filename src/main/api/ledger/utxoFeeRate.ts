import { FeeRate } from '@xchainjs/xchain-client'
import log from 'electron-log'

/**
 * Returns the fee rate chosen by the renderer (`resolveUtxoFeeRate`: provider estimate clamped to chain min/max
 * and floored by the destination protocol `gas_rate`) so the fee paid matches the fee shown in the UI.
 * Only if that value is unusable (absent, NaN, <= 0), `fetchProviderRate` is used as fallback.
 */
export const resolveLedgerFeeRate = async (
  chain: string,
  feeRate: FeeRate | undefined,
  fetchProviderRate: () => Promise<FeeRate>
): Promise<FeeRate> => {
  if (typeof feeRate === 'number' && Number.isFinite(feeRate) && feeRate > 0) return feeRate
  log.warn(`[ledger] ${chain}: invalid fee rate "${feeRate}" received via IPC, falling back to provider rate`)
  return fetchProviderRate()
}
