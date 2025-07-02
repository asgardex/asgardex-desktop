export function clampDecimals(value: number, maxDecimals: number = 8): number {
  if (!Number.isFinite(value)) return value

  const [, decimalPart] = value.toString().split('.')
  if (!decimalPart || decimalPart.length <= maxDecimals) return value

  return Number(value.toFixed(maxDecimals))
}
