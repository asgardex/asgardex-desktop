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
import { AssetIcon } from '../assetIcon'
import * as Styled from './AssetData.styles'

type Props = {
  asset: AnyAsset
  walletType?: WalletType
  noTicker?: boolean
  amount?: BaseAmount
  size?: Styled.AssetDataSize
  // `className` is needed by `styled components`
  className?: string
  network: Network
}

export const AssetData = (props: Props): JSX.Element => {
  const { asset, walletType, amount: assetAmount, noTicker = false, size = 'small', className, network } = props

  const intl = useIntl()

  return (
    <div className={clsx('flex items-center flex-wrap py-1 mr-2 last:m-0', className)}>
      <Styled.AssetIconContainer>
        <AssetIcon asset={asset} size={size} network={network} />
      </Styled.AssetIconContainer>
      {!noTicker && (
        <Styled.LabelContainer>
          <Styled.TickerLabel>{`${asset.ticker}`}</Styled.TickerLabel>
          <Styled.ChainLabelWrapper>
            {!isSynthAsset(asset) && !isSecuredAsset(asset) && <Styled.ChainLabel>{asset.chain}</Styled.ChainLabel>}
            {isSynthAsset(asset) && <Styled.AssetSynthLabel>synth</Styled.AssetSynthLabel>}
            {isSecuredAsset(asset) && <Styled.AssetSecuredLabel>secured</Styled.AssetSecuredLabel>}
          </Styled.ChainLabelWrapper>
          {walletType && isLedgerWallet(walletType) && (
            <Styled.WalletTypeLabel>{walletTypeToI18n(walletType, intl)}</Styled.WalletTypeLabel>
          )}
          {walletType && isKeystoreWallet(walletType) && (
            <Styled.WalletTypeLabel>{walletTypeToI18n(walletType, intl)}</Styled.WalletTypeLabel>
          )}
        </Styled.LabelContainer>
      )}
      {assetAmount && (
        <div className="mr-2 last:m-0">
          <Styled.AmountLabel size={size}>
            {formatAssetAmountCurrency({ amount: baseToAsset(assetAmount), asset, trimZeros: true })}
          </Styled.AmountLabel>
        </div>
      )}
    </div>
  )
}
