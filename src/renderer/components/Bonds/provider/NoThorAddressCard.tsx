import { useIntl } from 'react-intl'

import { RefreshButton } from '../../uielements/button'

type Props = {
  onReload: () => void
}

export const NoThorAddressCard = ({ onReload }: Props) => {
  const intl = useIntl()

  return (
    <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-gray0 bg-bg0 p-6 lg:flex-row lg:items-center lg:justify-between dark:border-gray0d dark:bg-bg0d">
      <div className="flex flex-col gap-2">
        <span className="font-main-semi-bold text-[16px] text-text0 dark:text-text0d">
          {intl.formatMessage({ id: 'bonds.provider.noThorAddress.title' })}
        </span>
        <span className="font-main text-[14px] text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.noThorAddress.desc' })}
        </span>
      </div>
      <RefreshButton onClick={onReload} />
    </div>
  )
}
