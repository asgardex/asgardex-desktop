import { useState } from 'react'

import { Meta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'

import {
  AssetBCH,
  AssetBSC,
  AssetBTC,
  AssetDOGE,
  AssetETH,
  AssetLTC,
  AssetRuneNative
} from '../../../../../shared/utils/asset'
import * as AT from '../../../../storybook/argTypes'
import { AssetSelect as Component } from './AssetSelect'

const assets = [AssetBTC, AssetBSC, AssetRuneNative, AssetETH, AssetLTC, AssetBCH, AssetDOGE]

type Args = {
  network: Network
  dialogHeadline: string
  onSelect: (asset: AnyAsset) => void
}

const Template = ({ network, onSelect, dialogHeadline }: Args) => {
  const [asset, setAsset] = useState<AnyAsset>(AssetBSC)
  return (
    <Component
      asset={asset}
      assets={assets}
      onSelect={(asset) => {
        onSelect(asset)
        setAsset(asset)
      }}
      dialogHeadline={dialogHeadline}
      network={network}
    />
  )
}
export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/Assets/AssetSelect',
  argTypes: {
    network: AT.network,
    onSelect: {
      action: 'onSelect'
    }
  },
  args: { network: Network.Mainnet, dialogHeadline: 'Change asset' },
  decorators: [
    (Story) => (
      <div className="flex min-h-full w-full flex-col items-center justify-center bg-white">
        <h1 className="uppercase text-gray2">Random headline</h1>
        <p className="uppercase text-gray1">Some random text</p>
        <Story />
      </div>
    )
  ]
}

export default meta
