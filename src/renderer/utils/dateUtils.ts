export const isChristmasSeason = (): boolean => {
  const now = new Date()
  const month = now.getMonth()
  return month === 11 // December is month 11 (0-indexed)
}
