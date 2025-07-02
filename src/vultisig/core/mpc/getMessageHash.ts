import { createHash } from 'crypto'

/**
 * Calculates the MD5 hash of a given message.
 * @param message - The message to hash.
 * @returns The MD5 hash of the message.
 */
export const getMessageHash = (message: string): string => {
  const hash = createHash('md5')
  hash.update(message)
  return hash.digest('hex')
}
