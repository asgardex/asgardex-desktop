import crypto from 'crypto'

import { AesGcmInput } from './AesGcmInput'

export const decryptWithAesGcm = ({ key, value }: AesGcmInput) => {
  // Hash the password to create a key
  const cipherKey = crypto.createHash('sha256').update(key).digest()

  // Create a new AES cipher using the key
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    cipherKey,
    value.subarray(0, 12) // Nonce is the first 12 bytes
  )

  const ciphertext = value.subarray(12, -16) // Exclude the nonce and the auth tag
  const authTag = value.subarray(-16) // Last 16 bytes is the auth tag

  // Set the authentication tag
  decipher.setAuthTag(authTag)

  // Decrypt the vault
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
