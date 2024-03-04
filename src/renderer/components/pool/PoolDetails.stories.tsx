import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import * as O from 'fp-ts/Option'

import { AssetETH } from '../../../shared/utils/asset'
import { ONE_BN } from '../../const'
import * as AT from '../../storybook/argTypes'
import { PoolHistoryActions } from '../../views/pool/PoolHistoryView.types'
import { PoolDetails as Component, Props } from './PoolDetails'
import { getEmptyPoolDetail, getEmptyPoolStatsDetail } from './PoolDetails.helpers'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />
export const Default = Template.bind({})

const historyActions: PoolHistoryActions = {
  requestParams: { itemsPerPage: 0, page: 0 },
  loadHistory: (params) => console.log('load history', params),
  setFilter: (filter) => console.log('filter', filter),
  setPage: (page) => console.log('page', page),
  reloadHistory: () => console.log('reloadHistory'),
  historyPage: RD.initial,
  prevHistoryPage: O.none
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/PoolDetails',
  argTypes: {
    network: AT.network,
    watch: { action: 'watch' },
    unwatch: { action: 'unwatch' }
  },
  args: {
    network: Network.Mainnet,
    historyActions,
    poolDetail: RD.success(getEmptyPoolDetail()),
    reloadPoolDetail: () => console.log('reloadPoolDetail'),
    poolStatsDetail: RD.success(getEmptyPoolStatsDetail()),
    reloadPoolStatsDetail: () => console.log('reloadPoolStatsDetail'),
    priceSymbol: 'R',
    asset: AssetETH,
    watched: true,
    priceRatio: ONE_BN,
    HistoryView: () => <>Actions History Here</>,
    ChartView: () => <>Pool Chart Here</>
  }
}

export default meta
