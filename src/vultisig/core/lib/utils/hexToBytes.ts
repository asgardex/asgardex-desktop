export const hexToBytes = (hex: string): Uint8Array => {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex

  if (normalized.length % 2 !== 0) {
    throw new Error('Invalid hex string: length must be even')
  }

  const byteArray = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < normalized.length; i += 2) {
    byteArray[i / 2] = parseInt(normalized.slice(i, i + 2), 16)
  }

  return byteArray
}
