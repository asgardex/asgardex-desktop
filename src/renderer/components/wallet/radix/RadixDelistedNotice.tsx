import { useIntl } from 'react-intl'

export const RadixDelistedNotice = (): JSX.Element => {
  const intl = useIntl()

  return (
    <p className="text-left font-main text-[11px] leading-4 font-medium text-warning0 normal-case dark:text-warning0d">
      {intl.formatMessage({ id: 'wallet.radix.delisted.title' })}
      <span className="font-normal text-text2 dark:text-text2d">
        {' · '}
        {intl.formatMessage({ id: 'wallet.radix.delisted.detail' })}
      </span>
    </p>
  )
}
