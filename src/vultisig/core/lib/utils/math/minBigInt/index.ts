export function minBigInt(...args: bigint[]): bigint {
  if (args.length === 0) {
    throw new Error('minBigInt: No arguments provided')
  }

  let minValue = args[0]
  for (const value of args) {
    if (value < minValue) {
      minValue = value
    }
  }
  return minValue
}
