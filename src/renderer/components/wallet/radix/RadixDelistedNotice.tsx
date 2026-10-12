import { useIntl } from 'react-intl'

export const RadixDelistedNotice = (): JSX.Element => {
  const intl = useIntl()

  return (
    <p className="text-xs leading-snug text-warning0 dark:text-warning0d">
      {intl.formatMessage({ id: 'wallet.radix.delisted' })}
    </p>
  )
}
