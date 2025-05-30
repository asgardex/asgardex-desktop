import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
// require('dotenv').config()

const TESTNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_TESTNET_URL, 'https://testnet.midgard.thorchain.info')

const STAGENET_URL = envOrDefault(
  import.meta.env.VITE_MIDGARD_MAYA_STAGENET_URL,
  'https://stagenet.midgard.mayachain.info'
)

const MAINNET_URL = envOrDefault(import.meta.env.VITE_MIDGARD_MAYA_MAINNET_URL, 'https://midgard-maya.liquify.com')

export const DEFAULT_MIDGARD_MAYA_URLS: ApiUrls = {
  mainnet: MAINNET_URL,
  stagenet: STAGENET_URL,
  testnet: TESTNET_URL
}
