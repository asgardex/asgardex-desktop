import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { chainToString } from '../../../../shared/utils/chain'
import { AddressEllipsis } from '../addressEllipsis'
import { Modal } from '../modal'
import { QRCode } from '../qrCode'

export type Props = {
  asset: AnyAsset
  address: string
  network: Network
  visible?: boolean
  onCancel?: FP.Lazy<void>
  onOk?: FP.Lazy<void>
}

export const QRCodeModal = ({
  asset,
  address,
  network,
  visible = false,
  onOk = FP.constVoid,
  onCancel = FP.constVoid
}: Props): JSX.Element => {
  const intl = useIntl()

  return (
    <Modal
      key="qr-code-modal"
      title={intl.formatMessage(
        { id: 'wallet.action.receive.title' },
        { asset: `${asset.ticker} (${chainToString(asset.chain)})` }
      )}
      visible={visible}
      onCancel={onCancel}
      onOk={() => onOk()}
      okButtonProps={{ autoFocus: true }}>
      <QRCode text={address} qrError={intl.formatMessage({ id: 'wallet.receive.address.errorQR' })} />
      <div key={'address info'} className="mt-5 flex grow flex-row items-center">
        <AddressEllipsis
          enableCopy
          network={network}
          chain={asset.chain}
          address={address}
          className="max-w-full overflow-hidden text-base only:m-auto [&_svg]:h-5 [&_svg]:w-5"
        />
      </div>
    </Modal>
  )
}
