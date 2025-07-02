/* eslint-disable @typescript-eslint/no-explicit-any */
type UnionKeys<T> = T extends any ? keyof T : never

export function getRecordUnionKey<T extends Record<string, any>>(record: T): UnionKeys<T> {
  return Object.keys(record)[0] as UnionKeys<T>
}
