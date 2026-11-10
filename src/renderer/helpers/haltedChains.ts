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
 * Then the unknown halt (all flags set, see `UNKNOWN_MIMIR_HALT`) is used, which blocks liquidity actions.
 * Swaps and swap quotes use `resolveSwapHaltState` instead: an unknown status alone does not block them.
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

/**
 * Halt state for swaps and swap quotes.
 *
 * An *unknown* halt status alone does not block swaps or quote requests: whether a route works is decided by
 * the THORNode / MAYANode quote (a swap needs a valid quote). Liquidity actions and RUNE sends stay blocked
 * while the status is unknown (`resolveHaltState`, `isRuneSendDisabled`).
 *
 * Only the synthetic flags of an unknown status are dropped, every *known* signal is kept:
 * - mimir loaded, `inbound_addresses` unknown -> the loaded mimir halts still apply, no halted chains from inbound
 * - `inbound_addresses` loaded, mimir unknown -> the loaded halted chains still apply, no mimir halts
 */
export const resolveSwapHaltState = <M extends { haltStatusUnknown?: boolean }>(
  haltedChainsRD: RD.RemoteData<Error, Chain[]>,
  mimirHalt: M,
  defaultMimirHalt: M
): { haltedChains: Chain[]; mimirHalt: M } => ({
  haltedChains: RD.isSuccess(haltedChainsRD) ? haltedChainsRD.value : [],
  mimirHalt: mimirHalt.haltStatusUnknown ? defaultMimirHalt : mimirHalt
})
