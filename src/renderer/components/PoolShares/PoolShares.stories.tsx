import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase, bn } from '@xchainjs/xchain-util'

import { AssetBSC, AssetBTC } from '../../../shared/utils/asset'
import { ZERO_BASE_AMOUNT } from '../../const'
import { DEFAULT_MIMIR_HALT } from '../../services/thorchain/const'
import { PoolShares as Component, Props as ComponentProps } from './PoolShares'

const defaultProps: ComponentProps = {
  haltedChains: [],
  mimirHalt: DEFAULT_MIMIR_HALT,
  data: [
    {
      asset: AssetBSC,
      sharePercent: bn(10),
      runeShare: assetToBase(assetAmount(10)),
      assetShare: assetToBase(assetAmount(20)),
      assetDepositPrice: assetToBase(assetAmount(100)),
      runeDepositPrice: assetToBase(assetAmount(200)),
      type: 'sym'
    },
    {
      asset: AssetBTC,
      sharePercent: bn(20),
      runeShare: assetToBase(assetAmount(1)),
      assetShare: assetToBase(assetAmount(100)),
      assetDepositPrice: assetToBase(assetAmount(1000)),
      runeDepositPrice: assetToBase(assetAmount(10)),
      type: 'sym'
    },
    {
      asset: AssetBTC,
      sharePercent: bn(10),
      runeShare: ZERO_BASE_AMOUNT,
      assetShare: assetToBase(assetAmount(50)),
      assetDepositPrice: assetToBase(assetAmount(1000)),
      runeDepositPrice: assetToBase(assetAmount(10)),
      type: 'asym'
    }
  ],
  loading: false,
  priceAsset: AssetBSC,
  openShareInfo: () => console.log('go to stake info'),
  network: Network.Testnet,
  dex: 'THOR'
}
export const Default: StoryFn = () => <Component {...defaultProps} />

export const Loading: StoryFn = () => {
  const props: ComponentProps = {
    ...defaultProps,
    data: [],
    loading: true
  }
  return <Component {...props} />
}

const meta: Meta = {
  component: Component,
  title: 'Components/PoolShares'
}

export default meta
