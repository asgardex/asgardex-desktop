import { ApiUrls } from '../api/types'
import { maskMidgardUrl, PUBLIC_LIQUIFY_THORCHAIN_MIDGARD } from '../thorchain/const'
import { envOrDefault } from '../utils/env'

const TESTNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_TESTNET_URL, 'https://testnet.midgard.thorchain.info')

const STAGENET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_STAGENET_URL, '')

// Defaults stay public; authenticated Liquify Midgard is applied via resolveMidgardUrl().
const MAINNET_URL = maskMidgardUrl(
  envOrDefault(import.meta.env.VITE_MIDGARD_MAINNET_URL, PUBLIC_LIQUIFY_THORCHAIN_MIDGARD)
)

export const DEFAULT_MIDGARD_URLS: ApiUrls = {
  mainnet: MAINNET_URL,
  stagenet: STAGENET_URL,
  testnet: TESTNET_URL
}

// Transparent fallback when the configured primary fails its /v2/health check.
// Use the official thorchain.network endpoint as a known-good default.
export const FALLBACK_MIDGARD_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MIDGARD_MAINNET_FALLBACK_URL, 'https://midgard.thorchain.network'),
  stagenet: '',
  testnet: ''
}
