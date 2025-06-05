import React, { useMemo } from 'react'

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { Dropdown } from 'antd'
import clsx from 'clsx'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { isLedgerWallet } from '../../../shared/utils/guard'
import { WalletAddress, WalletAddresses } from '../../../shared/wallet/types'
import { truncateAddress } from '../../helpers/addressHelper'
import { getChainAsset } from '../../helpers/chainHelper'
import { eqWalletAddress } from '../../helpers/fp/eq'
import { walletTypeToI18n } from '../../services/wallet/util'
import { AssetIcon } from '../uielements/assets/assetIcon/AssetIcon'
import { Size as IconSize } from '../uielements/assets/assetIcon/AssetIcon.types'
import { WalletTypeLabel } from '../uielements/common/Common.styles'
import * as Styled from './AccountAddressSelector.styles'

type Props = {
  selectedAddress: O.Option<WalletAddress>
  addresses: WalletAddresses
  size?: IconSize
  network: Network
  onChangeAddress?: (address: WalletAddress) => void
  disabled?: boolean
}

export const AccountAddressSelector: React.FC<Props> = (props) => {
  const {
    selectedAddress: oSelectedAddress,
    addresses,
    size = 'small',
    network,
    onChangeAddress = FP.constVoid,
    disabled = false
  } = props

  const intl = useIntl()

  const menu = useMemo(() => {
    const isSelected = (address: WalletAddress) =>
      FP.pipe(
        oSelectedAddress,
        O.fold(
          () => false,
          (selectedAddress) => eqWalletAddress.equals(address, selectedAddress)
        )
      )

    return (
      <Styled.Menu
        items={FP.pipe(
          addresses,
          A.map((walletAddress) => {
            const { address, type, chain } = walletAddress
            const selected = isSelected(walletAddress)
            return {
              label: (
                <div
                  className="flex items-center justify-between text-14 p-1"
                  onClick={() => onChangeAddress(walletAddress)}>
                  <div className="flex items-center">
                    <AssetIcon className="m-0.5" asset={getChainAsset(chain)} size={size} network={network} />
                    <div className="my-1 mx-4 text-text2 dark:text-text2d">{address}</div>
                  </div>
                  {isLedgerWallet(type) && (
                    <WalletTypeLabel
                      className={clsx(
                        'leading-[14px]',
                        selected ? 'bg-gray1 dark:bg-gray1d' : 'bg-gray0 dark:bg-gray0d'
                      )}>
                      {walletTypeToI18n(type, intl)}
                    </WalletTypeLabel>
                  )}
                </div>
              ),
              key: `${chain}:${address}`
            }
          })
        )}
      />
    )
  }, [addresses, intl, network, oSelectedAddress, onChangeAddress, size])

  const renderSelectedAddress = FP.pipe(
    oSelectedAddress,
    O.fold(
      () => <></>,
      ({ chain, type, address }) => (
        <div className="flex items-center justify-between border border-solid border-turquoise rounded px-2 py-1">
          <div className="flex items-center">
            <AssetIcon asset={getChainAsset(chain)} size="xsmall" network={network} />
            <div className="ml-1 text-14 text-turquoise">{truncateAddress(address, chain, network)}</div>
            {isLedgerWallet(type) && <WalletTypeLabel>{walletTypeToI18n(type, intl)}</WalletTypeLabel>}
          </div>
          <ChevronDownIcon className="ml-4 text-turquoise" width={16} height={16} />
        </div>
      )
    )
  )

  return (
    <Dropdown overlay={menu} trigger={['click']} disabled={disabled}>
      <Styled.DropdownSelectorWrapper disabled={disabled}>{renderSelectedAddress}</Styled.DropdownSelectorWrapper>
    </Dropdown>
  )
}
