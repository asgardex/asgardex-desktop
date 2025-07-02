import crypto from 'crypto'

export function getHexEncodedRandomBytes(length: number): string {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error('Length must be a non-negative integer')
  }
  const bytes = crypto.randomBytes(length)
  return bytes.toString('hex')
}
