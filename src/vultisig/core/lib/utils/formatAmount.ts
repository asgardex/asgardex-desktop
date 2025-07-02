const million = 1000000
const billion = 1000000000

const fiatMaxDecimalPlaces = 3
const tokenMaxDecimalPlaces = 8

// formatAmount is used to format a Fiat amount or a Token amount
export const formatAmount = (amount: number, currency: string, locale = 'en-us'): string => {
  if (amount > billion) {
    return `${formatAmount(amount / billion, currency, locale)}B`
  }
  if (amount > million) {
    return `${formatAmount(amount / million, currency, locale)}M`
  }

  // Validate and set locale safely
  let validLocale = 'en-US'
  try {
    validLocale = new Intl.NumberFormat(locale).resolvedOptions().locale
  } catch (error: unknown) {
    console.warn(`Invalid locale provided: ${locale}. Falling back to 'en-US'. ${error}`)
  }

  try {
    const formatter = new Intl.NumberFormat(validLocale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: fiatMaxDecimalPlaces
    })

    return formatter.format(amount)
  } catch {
    const formatter = new Intl.NumberFormat(validLocale, {
      maximumFractionDigits: tokenMaxDecimalPlaces
    })

    return `${formatter.format(amount)} ${currency}`
  }
}
