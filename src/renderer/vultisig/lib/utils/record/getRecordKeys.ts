/* eslint-disable @typescript-eslint/no-explicit-any */
export const getRecordKeys = <K extends string | number>(record: Record<K, any>): K[] => {
  return Object.keys(record) as K[]
}
