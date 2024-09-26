import { useState } from 'react'

import { Meta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'

import { AssetBCH, AssetBTC, AssetDOGE, AssetETH, AssetLTC, AssetRuneNative } from '../../../../../shared/utils/asset'
import * as AT from '../../../../storybook/argTypes'
import { AssetMenu as Component, Props } from './AssetMenu'

const assets = [AssetBTC, AssetRuneNative, AssetETH, AssetLTC, AssetBCH, AssetDOGE]

const Template = ({ network, onSelect, open, onClose, headline }: Props) => {
  const [asset, setAsset] = useState<AnyAsset>(AssetBTC)
  const [openMenu, setOpenMenu] = useState(open)
  return (
    <Component
      asset={asset}
      assets={assets}
      open={openMenu}
      headline={headline}
      onSelect={(asset) => {
        onSelect(asset)
        setAsset(asset)
        setOpenMenu(false)
      }}
      onClose={() => {
        onClose()
        setOpenMenu(false)
      }}
      network={network}
    />
  )
}
export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/Assets/AssetMenu',
  argTypes: {
    network: AT.network,
    onSelect: {
      action: 'onSelect'
    },
    onClose: {
      action: 'onClose'
    }
  },
  args: { network: Network.Mainnet, open: true, headline: 'Menu headline' },
  decorators: [
    (Story) => (
      <div className="flex min-h-full w-full bg-white">
        <Story />
      </div>
    )
  ]
}

export default meta
