import { Network } from '@xchainjs/xchain-client'
import { useIntl } from 'react-intl'

import { isLedgerWallet } from '../../../../shared/utils/guard'
import { WalletBalance } from '../../../services/wallet/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { Size as IconSize } from '../../uielements/assets/assetIcon/AssetIcon.types'
import { WalletTypeLabel } from '../../uielements/common/Common.styles'
import { Label } from '../../uielements/label'

export type Props = {
  selectedWallet: WalletBalance
  size?: IconSize
  network: Network
}

export const AccountSelector = (props: Props): JSX.Element => {
  const { selectedWallet, size = 'large', network } = props

  const intl = useIntl()

  return (
    <div className="py-4">
      <div className="flex items-center">
        <AssetIcon asset={selectedWallet.asset} size={size} network={network} />
        <div className="flex flex-col justify-between ml-8">
          <div className="flex items-center space-x-4">
            <Label className="text-[36px] leading-10" textTransform="uppercase">
              {selectedWallet.asset.ticker}
            </Label>
            {isLedgerWallet(selectedWallet.walletType) && (
              <WalletTypeLabel>{intl.formatMessage({ id: 'ledger.title' })}</WalletTypeLabel>
            )}
          </div>
          <Label color="light" size="large" textTransform="uppercase">
            {selectedWallet.asset.chain}
          </Label>
        </div>
      </div>
    </div>
  )
}
