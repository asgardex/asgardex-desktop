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
import { assetChainQualifier } from '../../../../helpers/assetHelper'
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
  /** Wallet qualifier on the ticker line, as in "BTC · Taproot". */
  badge?: string
}

export const AssetData = (props: Props): JSX.Element => {
  const { asset, walletType, amount: assetAmount, noTicker = false, size = 'small', className, network, badge } = props

  const intl = useIntl()
  // A wallet badge such as Taproot replaces the chain qualifier on this line.
  const inlineQualifier = badge || assetChainQualifier(asset)

  return (
    <div className={clsx('mr-2 flex flex-nowrap items-center py-1 last:m-0', className)}>
      <div className="relative mr-2 flex items-center py-[10px]">
        <AssetIcon asset={asset} size={size} network={network} />
      </div>
      {!noTicker && (
        <div className="flex flex-col items-start">
          <div className="flex items-center pl-2">
            <Label
              className="h-[18px] !w-auto leading-[18px]"
              size="xbig"
              textTransform="uppercase"
              weight="bold"
              nowrap>
              {asset.ticker}
            </Label>
            {inlineQualifier && (
              <span className="ml-1.5 font-main-semi-bold text-[14px] leading-[18px] whitespace-nowrap text-text2 normal-case dark:text-text2d">
                <span className="mr-1.5 font-main text-gray1 dark:text-gray1d">·</span>
                {inlineQualifier}
              </span>
            )}
            {isSynthAsset(asset) && <AssetSynthLabel className="ml-1.5">synth</AssetSynthLabel>}
            {isSecuredAsset(asset) && <AssetSecuredLabel className="ml-1.5">secured</AssetSecuredLabel>}
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
