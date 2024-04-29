import { Network } from '@xchainjs/xchain-client'

import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
require('dotenv').config()

const MAINNET_LCD = envOrDefault(process.env.REACT_APP_COSMOS_MAINNET_LCD, 'https://rpc.cosmos.directory/cosmoshub')

export const getClientUrls = (): Record<Network, string> => ({
  [Network.Stagenet]: MAINNET_LCD,
  [Network.Mainnet]: MAINNET_LCD,
  [Network.Testnet]: 'https://rest.sentry-01.theta-testnet.polypore.xyz'
})
