/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'

import { order } from '.'

describe('order', () => {
  it('should sort an array in ascending order', () => {
    const array = [{ value: 3 }, { value: 1 }, { value: 2 }]
    const sorted = order(array, (item: { value: any }) => item.value, 'asc')
    expect(sorted).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }])
  })

  it('should sort an array in descending order', () => {
    const array = [{ value: 3 }, { value: 1 }, { value: 2 }]
    const sorted = order(array, (item: { value: any }) => item.value, 'desc')
    expect(sorted).toEqual([{ value: 3 }, { value: 2 }, { value: 1 }])
  })

  it('should handle an empty array', () => {
    const array: any[] = []
    const sortedAsc = order(array, (item: any) => item, 'asc')
    const sortedDesc = order(array, (item: any) => item, 'desc')
    expect(sortedAsc).toEqual([])
    expect(sortedDesc).toEqual([])
  })

  it('should handle an array with one element', () => {
    const array = [{ value: 42 }]
    const sortedAsc = order(array, (item: { value: any }) => item.value, 'asc')
    const sortedDesc = order(array, (item: { value: any }) => item.value, 'desc')
    expect(sortedAsc).toEqual([{ value: 42 }])
    expect(sortedDesc).toEqual([{ value: 42 }])
  })

  it('should not mutate the original array', () => {
    const array = [{ value: 3 }, { value: 1 }, { value: 2 }]
    const sorted = order(array, (item: { value: any }) => item.value, 'asc')
    expect(sorted).not.toBe(array) // Check if a new array is created
    expect(array).toEqual([{ value: 3 }, { value: 1 }, { value: 2 }]) // Original array unchanged
  })

  it('should handle arrays with duplicate values', () => {
    const array = [{ value: 2 }, { value: 3 }, { value: 2 }]
    const sortedAsc = order(array, (item: { value: any }) => item.value, 'asc')
    const sortedDesc = order(array, (item: { value: any }) => item.value, 'desc')
    expect(sortedAsc).toEqual([{ value: 2 }, { value: 2 }, { value: 3 }])
    expect(sortedDesc).toEqual([{ value: 3 }, { value: 2 }, { value: 2 }])
  })

  it('should work with negative numbers', () => {
    const array = [{ value: -1 }, { value: -3 }, { value: 2 }]
    const sortedAsc = order(array, (item: { value: any }) => item.value, 'asc')
    const sortedDesc = order(array, (item: { value: any }) => item.value, 'desc')
    expect(sortedAsc).toEqual([{ value: -3 }, { value: -1 }, { value: 2 }])
    expect(sortedDesc).toEqual([{ value: 2 }, { value: -1 }, { value: -3 }])
  })

  it('should work with custom numeric values', () => {
    const array = [{ age: 30 }, { age: 20 }, { age: 40 }]
    const sortedAsc = order(array, (item: { age: any }) => item.age, 'asc')
    const sortedDesc = order(array, (item: { age: any }) => item.age, 'desc')
    expect(sortedAsc).toEqual([{ age: 20 }, { age: 30 }, { age: 40 }])
    expect(sortedDesc).toEqual([{ age: 40 }, { age: 30 }, { age: 20 }])
  })
})
