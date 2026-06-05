import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

const TESTNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_TESTNET_URL, 'https://testnet.midgard.thorchain.info')

const STAGENET_URL = envOrDefault(
  import.meta.env.VITE_MIDGARD_MAYA_STAGENET_URL,
  'https://stagenet.midgard.mayachain.info'
)

const MAINNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_MAYA_MAINNET_URL, 'https://midgard.mayachain.info')

export const DEFAULT_MIDGARD_MAYA_URLS: ApiUrls = {
  mainnet: MAINNET_URL,
  stagenet: STAGENET_URL,
  testnet: TESTNET_URL
}

// Transparent fallback when the configured primary fails its /v2/health check.
// midgard-maya.liquify.com is the secondary endpoint listed by xchain-mayamidgard-query.
export const FALLBACK_MIDGARD_MAYA_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MIDGARD_MAYA_MAINNET_FALLBACK_URL, 'https://midgard-maya.liquify.com'),
  stagenet: '',
  testnet: ''
}
