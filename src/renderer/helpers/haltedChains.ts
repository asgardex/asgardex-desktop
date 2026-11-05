import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'

export type ResolvedHaltState<M> = {
  haltedChains: Chain[]
  /** The given mimir halt, or `unknownMimirHalt` if `haltedChainsRD` is not loaded */
  mimirHalt: M
  /** `haltedChainsRD` (`inbound_addresses`) is failed or not loaded */
  haltedChainsUnknown: boolean
}

/**
 * Halted chains come from `inbound_addresses`. If that request failed (or has not loaded yet) the list is
 * *unknown*, not empty: reading it as `[]` would mean "no chain halted" and fail open.
 * Then the unknown halt (all flags set, see `UNKNOWN_MIMIR_HALT`) is used, which blocks every action.
 */
export const resolveHaltState = <M>(
  haltedChainsRD: RD.RemoteData<Error, Chain[]>,
  mimirHalt: M,
  unknownMimirHalt: M
): ResolvedHaltState<M> =>
  RD.isSuccess(haltedChainsRD)
    ? { haltedChains: haltedChainsRD.value, mimirHalt, haltedChainsUnknown: false }
    : { haltedChains: [], mimirHalt: unknownMimirHalt, haltedChainsUnknown: true }

/**
 * RUNE sends (`MsgSend`) are rejected by THORNode while `IsChainHalted(THORChain)` is true
 * (`HALTTHORCHAIN`, `SOLVENCYHALTTHORCHAIN`, `HALTCHAINGLOBAL`, `NODEPAUSECHAINGLOBAL` - all folded
 * into `HALTTHORCHAIN`), and are blocked while the halt status is unknown.
 * `HALTTHORTRADING` is kept as before (trading halt on THORChain).
 */
export const isRuneSendDisabled = (mimirHalt: {
  HALTTHORCHAIN?: boolean
  HALTTHORTRADING?: boolean
  haltStatusUnknown?: boolean
}): boolean => !!(mimirHalt.HALTTHORCHAIN || mimirHalt.HALTTHORTRADING || mimirHalt.haltStatusUnknown)
