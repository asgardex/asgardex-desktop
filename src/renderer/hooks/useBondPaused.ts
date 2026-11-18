import { useMimirConstants } from './useMimirConstants'

const PAUSE_KEYS = ['PAUSEBOND']

// THORNode rejects every MsgBond (bond, provider whitelist, operator fee) while PAUSEBOND > 0
export const useBondPaused = (): boolean => {
  const { PAUSEBOND: pauseBond } = useMimirConstants(PAUSE_KEYS)
  return Number(pauseBond) > 0
}
