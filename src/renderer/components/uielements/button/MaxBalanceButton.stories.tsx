import { Meta } from '@storybook/react'
import { Balance } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'

import { AssetDOGE, AssetRuneNative } from '../../../../shared/utils/asset'
import { MaxBalanceButton as Component, ComponentProps } from './MaxBalanceButton'

export const MaxBalanceButton = (props: ComponentProps) => <Component {...props} />

const dogeBalance: Balance = {
  asset: AssetDOGE,
  amount: assetToBase(assetAmount(123))
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/button/MaxBalanceButton',
  argTypes: {
    balance: {
      options: ['DOGE', 'RUNE'],
      mappings: {
        DOGE: dogeBalance,
        RUNE: {
          asset: AssetRuneNative,
          amount: assetToBase(assetAmount(345))
        }
      }
    },
    onClick: { action: 'onClick' }
  },
  args: {
    maxInfoText: 'info text',
    balance: dogeBalance,
    hidePrivateData: false
  },
  decorators: [
    (S) => (
      <div className="flex h-screen items-center justify-center bg-white">
        <S />
      </div>
    )
  ]
}

export default meta
