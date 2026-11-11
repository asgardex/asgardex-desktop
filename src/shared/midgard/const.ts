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

// Optional second Midgard host. Empty by default: `midgard.thorchain.network` no longer
// resolves, and failing over to it replaces a live Liquify host with a dead name.
export const FALLBACK_MIDGARD_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MIDGARD_MAINNET_FALLBACK_URL, ''),
  stagenet: '',
  testnet: ''
}
