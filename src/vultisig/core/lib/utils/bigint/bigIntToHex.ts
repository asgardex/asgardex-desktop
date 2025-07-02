export const bigIntToHex = (value: bigint): string => {
  const hexString = value.toString(16)
  if (hexString.length % 2 !== 0) {
    return `0${hexString}`
  }
  return hexString
}
