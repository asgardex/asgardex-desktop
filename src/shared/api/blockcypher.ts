import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
require('dotenv').config()

export const blockcypherApiKeyBtc = envOrDefault(process.env.REACT_APP_BLOCKCYPHER_APIBTC_KEY, '')
export const blockcypherApiKeyLtc = envOrDefault(process.env.REACT_APP_BLOCKCYPHER_APILTC_KEY, '')
export const blockcypherApiKeyDoge = envOrDefault(process.env.REACT_APP_BLOCKCYPHER_APIDOGE_KEY, '')
export const blockcypherUrl = envOrDefault(process.env.REACT_APP_BLOCKCYPHER_URL, 'https://api.blockcypher.com/v1')
