import clsx from 'clsx'
import { useIntl } from 'react-intl'

type Props = {
  memo: string
  className?: string
}

export const MemoPreview = ({ memo, className }: Props) => {
  const intl = useIntl()

  return (
    <div
      className={clsx('mt-4 flex flex-col rounded-lg border border-solid border-gray1 dark:border-gray0d', className)}>
      <div className="flex items-center justify-between border-b border-solid border-gray1 px-4 py-2 dark:border-gray0d">
        <span className="font-main-semi-bold text-[11px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.modal.memo' })}
        </span>
        <span className="font-main text-[12px] text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.modal.thorchainTx' })}
        </span>
      </div>
      <span className="px-4 py-3 font-mono text-[13px] break-all text-text0 dark:text-text0d">{memo}</span>
    </div>
  )
}
