import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { chainToString } from '../../../../shared/utils/chain'
import { QRCode } from '../qrCode'
import * as Styled from './QRCodeModal.styles'

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
    <Styled.QRCodeModal
      key="qr-code-modal"
      title={intl.formatMessage(
        { id: 'wallet.action.receive.title' },
        { asset: `${asset.ticker} (${chainToString(asset.chain)})` }
      )}
      visible={visible}
      onCancel={onCancel}
      onOk={() => onOk()}>
      <QRCode text={address} qrError={intl.formatMessage({ id: 'wallet.receive.address.errorQR' })} />
      <Styled.AddressContainer key={'address info'}>
        <Styled.AddressEllipsis enableCopy network={network} chain={asset.chain} address={address} />
      </Styled.AddressContainer>
    </Styled.QRCodeModal>
  )
}
