/*
This code is from wagmi to support bigint in query keys
https://github.com/wevm/wagmi/blob/5275810a0459e3cef742d02c8ab7234b9a12c084/packages/core/src/query/utils.ts#L10
*/

import { type QueryKey } from '@tanstack/query-core'

export function queryKeyHashFn(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_, value) => {
    if (isPlainObject(value))
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] = (value as Record<string, unknown>)[key]
          return result
        }, {} as any)
    if (typeof value === 'bigint') return value.toString()
    return value
  })
}

// biome-ignore lint/complexity/noBannedTypes:
function isPlainObject(value: any): value is object {
  if (!hasObjectPrototype(value)) {
    return false
  }

  // If has modified constructor
  const ctor = value.constructor
  if (typeof ctor === 'undefined') return true

  // If has modified prototype
  const prot = ctor.prototype
  if (!hasObjectPrototype(prot)) return false

  // If constructor does not have an Object-specific method
  // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
  if (!Object.prototype.hasOwnProperty.call(prot, 'isPrototypeOf')) return false

  // Most likely a plain Object
  return true
}

function hasObjectPrototype(o: any): boolean {
  return Object.prototype.toString.call(o) === '[object Object]'
}
