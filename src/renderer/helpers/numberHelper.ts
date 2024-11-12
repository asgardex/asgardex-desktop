const suffixes = ['', 'K', 'M', 'B', 't', 'q', 'Q', 's']

export const abbreviateNumber = (value: number, decimal = 0): string => {
  let newValue = value
  let suffixNum = 0

  while (newValue >= 1000) {
    newValue /= 1000
    suffixNum++
  }

  return `${newValue.toFixed(decimal)}${suffixNum > 0 ? ` ${suffixes[suffixNum]}` : ''}`
}

export const getCurrencyFormat = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}
