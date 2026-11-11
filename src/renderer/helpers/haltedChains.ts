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
 * Then the unknown halt (all flags set, see `UNKNOWN_MIMIR_HALT`) is used, which blocks deposits.
 * Withdrawals use proven mimir halts only.
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
 * the THORNode / MAYANode quote (a swap needs a valid quote). Deposits and RUNE sends stay blocked
 * while the status is unknown (`resolveHaltState`, `isRuneSendDisabled`).
 *
 * Every *known* signal still blocks:
 * - `confirmedMimirHalt` (from `useThorchainMimirHalt` / `useMayachainMimirHalt`) carries the halts proven by
 *   fresh mimir, with conservative per-key checks when a value or height is uncertain
 * - a loaded `inbound_addresses` list keeps its halted chains; an unknown list adds none
 */
export const resolveSwapHaltState = <M>(
  haltedChainsRD: RD.RemoteData<Error, Chain[]>,
  confirmedMimirHalt: M
): { haltedChains: Chain[]; mimirHalt: M } => ({
  haltedChains: RD.isSuccess(haltedChainsRD) ? haltedChainsRD.value : [],
  mimirHalt: confirmedMimirHalt
})

/** LP exits follow IsChainHalted || IsLPPaused, never inbound trading halts or synthetic unknown flags. */
export const isWithdrawDisabled = ({
  chain,
  protocol,
  confirmedMimirHalt
}: {
  chain: Chain
  protocol: Chain
  confirmedMimirHalt: Record<string, boolean>
}): boolean =>
  !!(
    confirmedMimirHalt[`HALT${protocol}CHAIN`] ||
    confirmedMimirHalt[`HALT${chain}CHAIN`] ||
    confirmedMimirHalt.pauseGlobalLp ||
    confirmedMimirHalt[`PAUSELP${chain}`]
  )
