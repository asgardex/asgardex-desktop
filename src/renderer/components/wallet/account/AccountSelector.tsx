import { Network } from '@xchainjs/xchain-client'
import { useIntl } from 'react-intl'

import { isLedgerWallet } from '../../../../shared/utils/guard'
import { distinctChainId } from '../../../helpers/assetHelper'
import { WalletBalance } from '../../../services/wallet/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { Size as IconSize } from '../../uielements/assets/assetIcon/AssetIcon.types'
import { WalletTypeLabel } from '../../uielements/common'
import { Label } from '../../uielements/label'

export type Props = {
  selectedWallet: WalletBalance
  size?: IconSize
  network: Network
}

export const AccountSelector = (props: Props): JSX.Element => {
  const { selectedWallet, size = 'large', network } = props

  const intl = useIntl()
  const chainId = distinctChainId(selectedWallet.asset)

  return (
    <div className="py-4">
      <div className="flex items-center">
        <AssetIcon asset={selectedWallet.asset} size={size} network={network} />
        <div className="ml-8 flex flex-col justify-between">
          <div className="flex items-center space-x-4">
            <Label className="text-[36px] leading-10" textTransform="uppercase">
              {selectedWallet.asset.ticker}
            </Label>
            {isLedgerWallet(selectedWallet.walletType) && (
              <WalletTypeLabel>{intl.formatMessage({ id: 'ledger.title' })}</WalletTypeLabel>
            )}
          </div>
          {chainId && (
            <Label color="light" size="large" textTransform="uppercase">
              {chainId}
            </Label>
          )}
        </div>
      </div>
    </div>
  )
}
