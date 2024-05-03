import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'

import { AssetBTC, AssetRuneNative } from '../../../../../shared/utils/asset'
import { SwapAssets, Props } from './SwapAssets'

const defaultProps: Props = {
  stepDescription: 'step 1',
  source: { asset: AssetRuneNative, amount: assetToBase(assetAmount(30)) },
  target: { asset: AssetBTC, amount: assetToBase(assetAmount(1)) },
  network: Network.Testnet
}
export const Default: StoryFn = () => <SwapAssets {...defaultProps} />

const meta: Meta = {
  component: SwapAssets,
  title: 'Components/modal/extra/SwapAssets',
  decorators: [
    (Story) => (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '30px',
          height: '100vH'
        }}>
        <div style={{ backgroundColor: 'white' }}>
          <Story />
        </div>
      </div>
    )
  ]
}

export default meta
