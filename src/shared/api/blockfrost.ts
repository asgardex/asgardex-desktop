import { envOrDefault } from '../utils/env'

// expose env (needed to access ENVs by `envOrDefault`) in `main` thread)
require('dotenv').config()

export const adaApiKey = envOrDefault(process.env.REACT_APP_ADA_API_KEY, '')
