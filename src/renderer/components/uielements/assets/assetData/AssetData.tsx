import { Network } from '@xchainjs/xchain-client'
import {
  BaseAmount,
  formatAssetAmountCurrency,
  baseToAsset,
  AnyAsset,
  isSynthAsset,
  isSecuredAsset
} from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { walletTypeToI18n } from '../../../../services/wallet/util'
import { WalletTypeLabel, AssetSynthLabel, AssetSecuredLabel } from '../../common'
import { Label } from '../../label'
import { AssetIcon } from '../assetIcon'
import type { AssetDataSize } from './AssetData.styles'

type Props = {
  asset: AnyAsset
  walletType?: WalletType
  noTicker?: boolean
  amount?: BaseAmount
  size?: AssetDataSize
  className?: string
  network: Network
}

export const AssetData = (props: Props): JSX.Element => {
  const { asset, walletType, amount: assetAmount, noTicker = false, size = 'small', className, network } = props

  const intl = useIntl()

  return (
    <div className={clsx('mr-2 flex flex-wrap items-center py-1 last:m-0', className)}>
      <div className="relative mr-2 flex items-center py-[10px]">
        <AssetIcon asset={asset} size={size} network={network} />
      </div>
      {!noTicker && (
        <div className="flex flex-col items-start">
          <Label className="h-[18px] pr-4 pl-2 leading-[18px]" size="xbig" textTransform="uppercase" weight="bold">
            {asset.ticker}
          </Label>
          <div className="flex items-center">
            {!isSynthAsset(asset) && !isSecuredAsset(asset) && (
              <Label className="h-[18px] pr-4 pl-2 leading-[18px] font-medium" color="input">
                {asset.chain}
              </Label>
            )}
            {isSynthAsset(asset) && <AssetSynthLabel>synth</AssetSynthLabel>}
            {isSecuredAsset(asset) && <AssetSecuredLabel>secured</AssetSecuredLabel>}
          </div>
          {walletType && isLedgerWallet(walletType) && (
            <WalletTypeLabel className="ml-[10px] text-[8px] leading-3">
              {walletTypeToI18n(walletType, intl)}
            </WalletTypeLabel>
          )}
          {walletType && isKeystoreWallet(walletType) && (
            <WalletTypeLabel className="ml-[10px] text-[8px] leading-3">
              {walletTypeToI18n(walletType, intl)}
            </WalletTypeLabel>
          )}
        </div>
      )}
      {assetAmount && (
        <div className="mr-2 last:m-0">
          <Label className="pl-[10px]" textTransform="uppercase" weight="bold">
            {formatAssetAmountCurrency({ amount: baseToAsset(assetAmount), asset, trimZeros: true })}
          </Label>
        </div>
      )}
    </div>
  )
}
