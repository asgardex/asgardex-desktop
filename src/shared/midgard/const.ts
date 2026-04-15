import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

const TESTNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_TESTNET_URL, 'https://testnet.midgard.thorchain.info')

const STAGENET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_STAGENET_URL, 'https://stagenet-midgard.ninerealms.com')

const MAINNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_MAINNET_URL, 'https://gateway.liquify.com/chain/thorchain_midgard')

export const DEFAULT_MIDGARD_URLS: ApiUrls = {
  mainnet: MAINNET_URL,
  stagenet: STAGENET_URL,
  testnet: TESTNET_URL
}
