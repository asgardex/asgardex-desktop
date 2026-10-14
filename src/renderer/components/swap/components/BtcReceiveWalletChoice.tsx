import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { Button } from '../../uielements/button'

type Props = {
  taproot: boolean
  onSelect: (taproot: boolean) => void
}

export const BtcReceiveWalletChoice = ({ taproot, onSelect }: Props): JSX.Element => {
  const intl = useIntl()
  const options = [
    { taproot: false, label: intl.formatMessage({ id: 'common.nativeSegwit' }) },
    { taproot: true, label: intl.formatMessage({ id: 'common.taproot' }) }
  ]

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label={intl.formatMessage({ id: 'common.recipient' })}>
      {options.map((option) => {
        const selected = option.taproot === taproot
        return (
          <Button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            sizevalue="small"
            color="primary"
            typevalue={selected ? 'default' : 'outline'}
            className={clsx(
              'rounded-lg',
              selected ? '!bg-turquoise !text-white' : '!border-turquoise !bg-transparent !text-text0 dark:!text-text0d'
            )}
            onClick={(event) => {
              event.stopPropagation()
              if (!selected) onSelect(option.taproot)
            }}>
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
