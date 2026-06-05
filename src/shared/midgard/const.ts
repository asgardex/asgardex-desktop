import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

const TESTNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_TESTNET_URL, 'https://testnet.midgard.thorchain.info')

const STAGENET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_STAGENET_URL, '')

const MAINNET_URL = envOrDefault(
  import.meta.env.VITE_MIDGARD_MAINNET_URL,
  'https://gateway.liquify.com/chain/thorchain_midgard'
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
