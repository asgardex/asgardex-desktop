import { withoutDuplicates } from '../array/withoutDuplicates'

export const mergeRecordsOfArrays = <T>(...records: Partial<Record<string, T[]>>[]): Record<string, T[]> => {
  const allKeys = withoutDuplicates(records.flatMap((record) => Object.keys(record)))

  const result: Record<string, T[]> = {}
  allKeys.forEach((key) => {
    result[key] = records.flatMap((record) => record[key] ?? [])
  })

  return result
}
