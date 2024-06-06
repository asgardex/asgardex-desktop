import React from 'react'

import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { Dex } from '../../../shared/api/types'
import { WalletAddress, WalletAddresses } from '../../../shared/wallet/types'
import { AccountAddressSelector } from '../AccountAddressSelector'
import { PoolActionsHistoryFilter } from './PoolActionsHistoryFilter'
import { Filter } from './types'
import * as Styled from './WalletPoolActionsHistoryHeader.styles'

export type Props = {
  network: Network
  addresses: WalletAddresses
  selectedAddress: O.Option<WalletAddress>
  availableFilters: Filter[]
  currentFilter: Filter
  setFilter: (filter: Filter) => void
  onWalletAddressChanged: (address: WalletAddress) => void
  onClickAddressIcon: FP.Lazy<void>
  disabled?: boolean
  dex: Dex
}

export const WalletPoolActionsHistoryHeader: React.FC<Props> = (props) => {
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
    dex
  } = props

  return (
    <>
      <Styled.FilterContainer>
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
      </Styled.FilterContainer>
      <Styled.LinkContainer>
        <Styled.Headline onClick={onClickAddressIcon}>
          {dex.chain === THORChain ? `RuneScan` : 'MayaScan'}
          <Styled.ExplorerLinkIcon />
        </Styled.Headline>
      </Styled.LinkContainer>
    </>
  )
}
