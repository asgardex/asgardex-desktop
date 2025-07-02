export function withoutDuplicates<T>(
  items: Array<T | null | undefined>,
  areEqual: (a: T, b: T) => boolean = (a, b) => a === b
): T[] {
  const result: T[] = []

  items
    .filter((item): item is T => item !== null && item !== undefined)
    .forEach((item) => {
      if (!result.some((i) => areEqual(i, item))) {
        result.push(item)
      }
    })

  return result
}
