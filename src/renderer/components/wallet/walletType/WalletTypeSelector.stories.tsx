import { Meta, StoryObj } from '@storybook/react'

import { WalletType } from '../../../../shared/wallet/types'
import { WalletTypeSelector as Component } from './WalletTypeSelector'
import { SelectableWalletType } from './WalletTypeSelector.types'

// Define the type for the story's args
type Args = {
  selectedWalletType: WalletType
  walletTypes: SelectableWalletType[]
}

// Define the default story using StoryObj model, with explicit typing for the render method's argument
export const Default: StoryObj<Args> = {
  render: (args: Args) => {
    // Use 'args' directly, and TypeScript will infer the type based on the StoryObj<Args> generic
    const { selectedWalletType, walletTypes } = args
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px', backgroundColor: '#fff' }}>
        <Component
          selectedWalletType={selectedWalletType}
          walletTypes={walletTypes.map((t) => ({ label: t, type: t }))}
          onChange={(t) => console.log('onChanged:', t)}
        />
      </div>
    )
  },
  args: {
    selectedWalletType: 'keystore',
    walletTypes: ['keystore', 'ledger', 'custom']
  }
}

// Meta configuration
const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/WalletTypeSelector'
  // argTypes and other configurations...
}

export default meta
