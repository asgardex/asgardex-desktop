import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { WalletType } from '../../../../shared/wallet/types'

import { ConfirmationModal } from './ConfirmationModal'

type Props = {
  visible: boolean
  walletName: string
  walletType?: WalletType
  onSuccess: FP.Lazy<void>
  onClose: FP.Lazy<void>
}

export const RemoveWalletConfirmationModal = ({ visible, onClose, onSuccess, walletName, walletType }: Props) => {
  const intl = useIntl()

  const descriptionId =
    walletType === WalletType.Vultisig ? 'wallet.remove.label.description.vultisig' : 'wallet.remove.label.description'

  return (
    <ConfirmationModal
      visible={visible}
      onClose={onClose}
      onSuccess={onSuccess}
      title={intl.formatMessage({ id: 'wallet.remove.label' })}
      okText={intl.formatMessage({ id: 'wallet.action.forget' })}
      content={
        <div className="flex flex-col space-y-2">
          <span className="font-main-bold font-semibold text-text0 dark:text-text0d">
            {intl.formatMessage({ id: 'wallet.remove.label.title' }, { name: walletName })}
          </span>
          <span className="font-main text-14 text-text2 dark:text-text2d">
            {intl.formatMessage({ id: descriptionId })}
          </span>
        </div>
      }
    />
  )
}
