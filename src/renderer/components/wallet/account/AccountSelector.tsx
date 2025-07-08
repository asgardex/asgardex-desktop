import { useCallback, useMemo } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset, formatAssetAmountCurrency, baseToAsset, assetToString } from '@xchainjs/xchain-util'
import { Dropdown, Row, Col } from 'antd'
import { useIntl } from 'react-intl'

import { isLedgerWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { WalletBalances } from '../../../services/clients'
import { WalletBalance } from '../../../services/wallet/types'
import { AssetData } from '../../uielements/assets/assetData'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { Size as IconSize } from '../../uielements/assets/assetIcon/AssetIcon.types'
import { WalletTypeLabel } from '../../uielements/common/Common.styles'
import { FilterMenu } from '../../uielements/filterMenu'
import { Label } from '../../uielements/label'

export type Props = {
  selectedWallet: WalletBalance
  walletBalances?: WalletBalances
  onChange?: (params: { asset: AnyAsset; walletAddress: Address; walletType: WalletType; walletIndex: number }) => void
  size?: IconSize
  network: Network
}

const filterFunction = ({ asset }: WalletBalance, searchTerm: string) => {
  const { ticker } = asset
  return ticker?.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1
}

export const AccountSelector = (props: Props): JSX.Element => {
  const { selectedWallet, walletBalances = [], onChange = (_) => {}, size = 'large', network } = props

  const intl = useIntl()

  const filteredWalletBalances = useMemo(
    () =>
      walletBalances.filter(
        ({ asset, amount }) => asset.symbol !== selectedWallet.asset.symbol && amount.amount().isGreaterThan(0)
      ),
    [selectedWallet.asset.symbol, walletBalances]
  )
  const enableDropdown = filteredWalletBalances.length > 0

  const cellRenderer = useCallback(
    ({ asset, amount, walletAddress, walletType, walletIndex }: WalletBalance) => {
      const node = (
        <Row
          align={'middle'}
          gutter={[8, 0]}
          onClick={() => onChange({ asset, walletAddress, walletType, walletIndex: walletIndex ? walletIndex : 0 })}>
          <Col>
            <AssetData asset={asset} network={network} />
          </Col>
          <Col>{formatAssetAmountCurrency({ amount: baseToAsset(amount), asset })}</Col>
        </Row>
      )

      return { node, key: walletAddress + assetToString(asset) }
    },
    [network, onChange]
  )

  const menu = useMemo(
    () => (
      <FilterMenu
        placeholder={intl.formatMessage({ id: 'common.searchAsset' })}
        searchEnabled
        data={filteredWalletBalances}
        cellRenderer={cellRenderer}
        filterFunction={filterFunction}
      />
    ),
    [filteredWalletBalances, cellRenderer, intl]
  )

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

          {enableDropdown && (
            <Dropdown overlay={menu} trigger={['click']}>
              {/* Important note:
                  Label has to be wrapped into a `div` to avoid error render messages
                  such as "Function components cannot be given refs"
              */}
              <div>
                <Label className="cursor-pointer" color="primary" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.change' })}
                </Label>
              </div>
            </Dropdown>
          )}
        </div>
      </div>
    </div>
  )
}
