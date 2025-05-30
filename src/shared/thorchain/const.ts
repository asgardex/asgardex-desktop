import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
// require('dotenv').config()

export const DEFAULT_THORNODE_RPC_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_RPC, 'https://rpc.ninerealms.com'),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_RPC, 'https://stagenet-rpc.ninerealms.com'),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_THORNODE_RPC, 'https://rpc.ninerealms.com')
}

export const DEFAULT_THORNODE_API_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_API, 'https://thornode.ninerealms.com'),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_API, 'https://stagenet-thornode.ninerealms.com'),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_THORNODE_API, 'https://testnet.thornode.thorchain.info')
}
