import { envOrDefault } from '../utils/env'

export const adaApiKey = envOrDefault(import.meta.env.VITE_ADA_API_KEY, '')
