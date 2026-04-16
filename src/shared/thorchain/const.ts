import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

export const DEFAULT_THORNODE_RPC_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_RPC, 'https://gateway.liquify.com/chain/thorchain_rpc'),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_RPC, ''),
  testnet: ''
}

export const DEFAULT_THORNODE_API_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_API, 'https://gateway.liquify.com/chain/thorchain_api'),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_API, ''),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_THORNODE_API, 'https://testnet.thornode.thorchain.info')
}
