import { option as O } from 'fp-ts'

/**
 * Helper to get `hostname` from url
 */
export const getHostnameFromUrl = (url: string): O.Option<string> => O.tryCatch(() => new URL(url).hostname)
