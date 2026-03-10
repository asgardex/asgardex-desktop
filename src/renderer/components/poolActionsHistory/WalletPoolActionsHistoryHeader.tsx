import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { WalletAddress, WalletAddresses } from '../../../shared/wallet/types'
import { AccountAddressSelector } from '../AccountAddressSelector'
import { ExternalLinkIcon } from '../uielements/common'
import { Label } from '../uielements/label'
import { PoolActionsHistoryFilter } from './PoolActionsHistoryFilter'
import { Filter } from './types'

type Props = {
  network: Network
  addresses: WalletAddresses
  selectedAddress: O.Option<WalletAddress>
  availableFilters: Filter[]
  currentFilter: Filter
  setFilter: (filter: Filter) => void
  onWalletAddressChanged: (address: WalletAddress) => void
  onClickAddressIcon: FP.Lazy<void>
  disabled?: boolean
  protocol: Chain
}

export const WalletPoolActionsHistoryHeader = (props: Props) => {
  const intl = useIntl()
  const {
    network,
    addresses,
    selectedAddress: oSelectedAddress,
    availableFilters,
    currentFilter,
    setFilter,
    onClickAddressIcon,
    onWalletAddressChanged,
    disabled = false,
    protocol
  } = props

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-5 md:flex-row">
        <PoolActionsHistoryFilter
          availableFilters={availableFilters}
          currentFilter={currentFilter}
          onFilterChanged={setFilter}
          disabled={disabled}
        />
        <AccountAddressSelector
          addresses={addresses}
          network={network}
          selectedAddress={oSelectedAddress}
          onChangeAddress={onWalletAddressChanged}
          disabled={disabled}
        />
      </div>
      <div className="flex items-center justify-center pt-5 md:grow md:justify-end md:pt-0">
        <Label
          className="flex !w-auto items-center"
          size="large"
          textTransform="uppercase"
          align="center"
          weight="bold"
          onClick={onClickAddressIcon}>
          {protocol === THORChain
            ? intl.formatMessage({ id: 'common.runeScan' })
            : intl.formatMessage({ id: 'common.mayaExplorer' })}
          <ExternalLinkIcon className="ml-1" />
        </Label>
      </div>
    </>
  )
}
