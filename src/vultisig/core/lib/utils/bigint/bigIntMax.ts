/**
 * Returns the largest of the BigInt arguments.
 *
 * @param values - A list of BigInt values to compare
 * @returns The largest BigInt from the provided arguments
 * @throws Error if no arguments are provided
 */
export function bigIntMax(...values: bigint[]): bigint {
  if (values.length === 0) {
    throw new Error('No arguments provided to bigIntMax')
  }

  return values.reduce((max, current) => (current > max ? current : max), values[0])
}
