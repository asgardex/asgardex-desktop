import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
// require('dotenv').config()

export const DEFAULT_MAYANODE_RPC_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_MAYANODE_RPC, 'https://tendermint.mayachain.info'),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_MAYANODE_RPC, 'https://tendermint.mayachain.info'),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_MAYANODE_RPC, 'https://tendermint.mayachain.info')
}

export const DEFAULT_MAYANODE_API_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_MAYANODE_API, 'https://mayanode.mayachain.info'),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_MAYANODE_API, 'https://stagenet.mayanode.mayachain.info'),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_MAYANODE_API, 'https://testnet.mayanode.mayachain.info')
}
