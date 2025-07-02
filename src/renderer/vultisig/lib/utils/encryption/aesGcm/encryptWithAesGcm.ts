import crypto from 'crypto'

import { AesGcmInput } from './AesGcmInput'

export const encryptWithAesGcm = ({ key, value }: AesGcmInput): Buffer => {
  // Hash the password to create a key
  const cipherKey = crypto.createHash('sha256').update(key).digest()

  // Generate a random nonce (12 bytes for GCM)
  const nonce = crypto.randomBytes(12)

  // Create a new AES cipher using the key and nonce
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey, nonce)

  // Encrypt the vault
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()])

  // Get the authentication tag (16 bytes)
  const authTag = cipher.getAuthTag()

  // Combine nonce, ciphertext, and authTag into a single buffer
  return Buffer.concat([nonce, ciphertext, authTag])
}
