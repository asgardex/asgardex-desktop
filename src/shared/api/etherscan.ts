import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
// require('dotenv').config()

export const etherscanApiKey = envOrDefault(import.meta.env.VITE_ETHERSCAN_API_KEY, '')
