/* eslint-disable @typescript-eslint/no-explicit-any */
export const sortRecordKeysAlphabetically = <T extends Record<string, any>>(record: T): T => {
  const sortedEntries = Object.entries(record).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))

  return Object.fromEntries(sortedEntries) as T
}
