import { Meta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { assetFromString } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'

import * as AT from '../../../storybook/argTypes'
import { AsymAssetsWarning } from './AsymAssetsWarning'

type Args = {
  network: Network
  onClickOpenAsymTool: FP.Lazy<void>
  loading: boolean
  assets: string
}

const Template = ({ network, loading, onClickOpenAsymTool, assets }: Args) => {
  const assetList = FP.pipe(
    assets.split('|'),
    A.filterMap((assetString) => O.fromNullable(assetFromString(assetString)))
  )

  return (
    <AsymAssetsWarning
      assets={assetList}
      network={network}
      onClickOpenAsymTool={onClickOpenAsymTool}
      loading={loading}
    />
  )
}

export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/Deposit/AsymAssetsWarning',
  argTypes: {
    network: AT.network,
    assets: {
      name: 'Assets',
      control: {
        type: 'select',
        options: ['BSC.BNB', 'BSC.BNB|BTC.BTC', 'ETH.ETH']
      }
    },
    onClickOpenAsymTool: {
      action: 'onClickOpenAsymTool'
    }
  },
  args: {
    network: Network.Mainnet,
    loading: false,
    assets: 'BSC.BNB'
  }
}

export default meta
