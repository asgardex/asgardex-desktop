/**
 * Snapshot of Midgard `/v2/health` fields the app uses to decide a host is usable.
 * `inSync: false` means the scanner is still catching up, not that the host is down.
 */
export type MidgardHealthSnapshot = {
  database?: boolean
  inSync?: boolean
  scannerHeight?: string
  lastThorNode?: { height?: number }
}

/**
 * Scanner lag still treated as usable. About four minutes at a 6s THORChain block.
 * Liquify often sits a few blocks past its own `inSync` window and still serves pools.
 */
export const MIDGARD_USABLE_LAG_BLOCKS = 40

export const isMidgardUsable = (data: MidgardHealthSnapshot): boolean => {
  if (!data.database) return false
  if (data.inSync) return true
  const nodeHeight = data.lastThorNode?.height
  const scannerHeight = Number(data.scannerHeight)
  if (typeof nodeHeight !== 'number' || !Number.isFinite(scannerHeight)) return false
  const lag = nodeHeight - scannerHeight
  return lag >= 0 && lag <= MIDGARD_USABLE_LAG_BLOCKS
}
