import { ApiUrls } from '../api/types'

/** Identifier for a provider. 'custom' means user-edited URLs. */
export type ProviderId = string

/** Badge type shown in the UI next to a provider name */
export type ProviderBadge = 'recommended' | 'backup'

/**
 * URL slot keys — maps to the CommonStorage URL field names.
 * THORChain needs 3 (midgard, thornodeApi, thornodeRpc).
 * MayaChain needs 3 (midgardMaya, mayanodeApi, mayanodeRpc).
 * EVM chains need 1 each.
 */
export type UrlSlotKey =
  | 'midgard'
  | 'thornodeApi'
  | 'thornodeRpc'
  | 'midgardMaya'
  | 'mayanodeApi'
  | 'mayanodeRpc'
  | 'ethRpc'
  | 'bscRpc'
  | 'arbRpc'
  | 'avaxRpc'
  | 'baseRpc'

/** A single provider entry — defines the URLs it supplies for a chain section */
export type ProviderEntry<Slots extends UrlSlotKey = UrlSlotKey> = {
  readonly id: ProviderId
  readonly name: string
  readonly description: string
  readonly badge?: ProviderBadge
  readonly domain: string
  readonly urls: Readonly<Record<Slots, ApiUrls>>
}

/** Config for one chain section in Expert Mode */
export type ChainProviderConfig<Slots extends UrlSlotKey = UrlSlotKey> = {
  readonly label: string
  readonly slots: readonly Slots[]
  readonly slotLabels: Readonly<Record<Slots, string>>
  readonly providers: readonly ProviderEntry<Slots>[]
  readonly defaultProviderId: ProviderId
}

/** Section keys — one per group in Expert Mode */
export type ProviderSectionKey = 'thorchain' | 'mayachain'

/** The full static registry — each section can have different slot types */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProviderRegistry = Readonly<Record<ProviderSectionKey, ChainProviderConfig<any>>>
