import { Meta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'

import { AssetBNB, AssetBTC } from '../../../../shared/utils/asset'
import * as AT from '../../../storybook/argTypes'
import { AssetWithAmount1e8, AssetsWithAmount1e8 } from '../../../types/asgardex'
import { PendingAssetsWarning as Component } from './PendingAssetsWarning'

const bnbAsset: AssetWithAmount1e8 = {
  amount1e8: assetToBase(assetAmount(1)),
  asset: AssetBNB
}

const btcAsset: AssetWithAmount1e8 = {
  asset: AssetBTC,
  amount1e8: assetToBase(assetAmount(2))
}

const assets: AssetsWithAmount1e8 = [bnbAsset, btcAsset]

type Args = {
  network: Network
  loading: boolean
}

const Template = ({ network, loading }: Args) => {
  return <Component pendingAssets={assets} failedAssets={assets} network={network} loading={loading} />
}

export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/Deposit/PendingAssetsWarning',
  argTypes: {
    network: AT.network
  },
  args: {
    network: Network.Mainnet,
    loading: false
  }
}

export default meta
