export const ensureHexPrefix = (hex: string) => (hex.startsWith('0x') ? hex : '0x' + hex)
