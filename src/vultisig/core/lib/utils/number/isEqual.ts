export const isEqual = (a: number, b: number, precision = 6) => Math.abs(a - b) < Math.pow(10, -precision)
