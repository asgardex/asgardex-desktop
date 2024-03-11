import { Meta, StoryObj } from '@storybook/react'

import { BNB_ADDRESS_MAINNET } from '../../../../shared/mock/address'
import { QRCode as Component } from './QRCode'

const meta: Meta<typeof Component> = {
  title: 'Components/QrCode',
  component: Component
}

export default meta

export const Default: StoryObj<typeof Component> = {
  args: {
    qrError: 'error for qr generation',
    text: BNB_ADDRESS_MAINNET
  }
}
