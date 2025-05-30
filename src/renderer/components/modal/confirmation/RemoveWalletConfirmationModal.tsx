import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ConfirmationModal } from './ConfirmationModal'

type Props = {
  visible: boolean
  walletName: string
  onSuccess: FP.Lazy<void>
  onClose: FP.Lazy<void>
}

export const RemoveWalletConfirmationModal: React.FC<Props> = ({ visible, onClose, onSuccess, walletName }) => {
  const intl = useIntl()

  return (
    <ConfirmationModal
      visible={visible}
      onClose={onClose}
      onSuccess={onSuccess}
      title={intl.formatMessage({ id: 'wallet.remove.label' })}
      okText={intl.formatMessage({ id: 'wallet.action.forget' })}
      content={
        <div className="flex flex-col space-y-2">
          <span className="font-mainBold font-semibold text-text0 dark:text-text0d">
            {intl.formatMessage({ id: 'wallet.remove.label.title' }, { name: walletName })}
          </span>
          <span className="font-main text-14 text-text2 dark:text-text2d">
            {intl.formatMessage({ id: 'wallet.remove.label.description' })}
          </span>
        </div>
      }
    />
  )
}
