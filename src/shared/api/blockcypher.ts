import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
require('dotenv').config()

export const blockcypherApiKey = envOrDefault(process.env.REACT_APP_BLOCKCYPHER_API_KEY, '')
export const blockcypherUrl = envOrDefault(process.env.REACT_APP_BLOCKCYPHER_URL, 'https://api.blockcypher.com/v1')
