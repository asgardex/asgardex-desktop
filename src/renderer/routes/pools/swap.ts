import { BTCChain } from '../../../shared/utils/chainIds'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { Route } from '../types'
import { base as poolsBase } from './base'

/** Query that selects the BTC Taproot wallet you spend from. Native SegWit and Taproot are both `BTC.BTC`. */
export const SWAP_SOURCE_HD_MODE_PARAM = 'sourceHdMode'
/** Query that selects the BTC Taproot wallet you receive to. */
export const SWAP_TARGET_HD_MODE_PARAM = 'targetHdMode'

/**
 * Taproot is the only BTC derivation that must be named on the swap route.
 * Anything else keeps the existing path so the page uses the Native SegWit wallet.
 */
export const sourceHdModeFromQuery = (chain: string, raw: string | null | undefined): HDMode | undefined =>
  chain === BTCChain && raw === 'p2tr' ? 'p2tr' : undefined

export const base: Route<void> = {
  template: `${poolsBase.template}/swap`,
  path() {
    return this.template
  }
}

export type SwapRouteTargetWalletType = WalletType | 'custom'
export type SwapRouteParams = {
  source: string
  target: string
  sourceWalletType: WalletType
  targetWalletType: SwapRouteTargetWalletType
  recipient?: string // Recipient address
  /**
   * BTC source derivation. `p2tr` opens the swap on the Taproot wallet.
   * Omitted for Native SegWit and every other chain.
   */
  sourceHdMode?: HDMode
  /** BTC destination derivation. `p2tr` pays the Taproot wallet. Omitted for Native SegWit. */
  targetHdMode?: HDMode
}

export const swap: Route<SwapRouteParams> = {
  /**
   * Use '|' 'cause asset symbols have '-' separator and / for synths.
   * `walletType` - wallet type of the source
   * check to see if asset string from source or target matches a synth, if true replace with a more route friendly string
   */
  template: `${base.template}/:source/:sourceWalletType/:target/:targetWalletType/:recipient?`,
  path: ({ source, target, sourceWalletType, targetWalletType, recipient, sourceHdMode, targetHdMode }) => {
    if (!!source && !!target) {
      const sourceString = source.match('/') ? source.replace('/', '_synth_') : source
      const targetString = target.match('/') ? target.replace('/', '_synth_') : target
      // Handle sources without a slash (non-synthetic assets)
      const basePath = `${base.template}/${sourceString}/${sourceWalletType}/${targetString}/${targetWalletType}`
      const withRecipient = recipient ? `${basePath}/${recipient}` : basePath
      // Native SegWit is the default BTC wallet. Only Taproot needs to be named,
      // otherwise the swap page picks the first BTC balance.
      const params = new URLSearchParams()
      if (sourceHdMode === 'p2tr') params.set(SWAP_SOURCE_HD_MODE_PARAM, 'p2tr')
      if (targetHdMode === 'p2tr') params.set(SWAP_TARGET_HD_MODE_PARAM, 'p2tr')
      const query = params.toString()
      return query ? `${withRecipient}?${query}` : withRecipient
    }
    // Redirect to base route if passed params are empty
    return base.path()
  }
}
