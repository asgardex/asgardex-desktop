type Input = {
  backup: ArrayBuffer
  password: string
}

export const decryptDatBackup = async ({ backup, password }: Input) => {
  const passwordBytes = new TextEncoder().encode(password)
  const passwordHash = await crypto.subtle.digest('SHA-256', passwordBytes)

  const key = await crypto.subtle.importKey('raw', passwordHash, { name: 'AES-GCM' }, false, ['decrypt'])

  const encryptedBytes = new Uint8Array(backup)
  const nonce = encryptedBytes.slice(0, 12)
  const ciphertextAndTag = encryptedBytes.slice(12)

  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce
    },
    key,
    ciphertextAndTag
  )
}
