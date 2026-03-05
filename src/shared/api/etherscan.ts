import { envOrDefault } from '../utils/env'

export const etherscanApiKey = envOrDefault(import.meta.env.VITE_ETHERSCAN_API_KEY, '')
