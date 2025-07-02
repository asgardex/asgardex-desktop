const tokenMaxDecimalPlaces = 8

export const formatTokenAmount = (amount: number, tokenUnit?: string): string => {
  // Validate and set locale safely
  const validLocale = 'en-US'
  const formatter = new Intl.NumberFormat(validLocale, {
    maximumFractionDigits: tokenMaxDecimalPlaces
  })

  return `${formatter.format(amount)} ${tokenUnit ?? ''}`
}
