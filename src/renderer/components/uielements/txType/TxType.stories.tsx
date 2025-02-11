import { ArgTypes, Meta } from '@storybook/react'

import { TxType as MidgardTxType } from '../../../services/midgard/types'
import { TxType } from './TxType'

const types = ['Swap', 'Deposit', 'Withdraw', 'Donate', 'Refund']

type InputType = typeof types[number]

const mapType = (type: InputType): MidgardTxType => {
  switch (type) {
    case types[0]: {
      return 'SWAP'
    }
    case types[1]: {
      return 'DEPOSIT'
    }
    case types[2]: {
      return 'WITHDRAW'
    }
    case types[3]: {
      return 'DONATE'
    }
    case types[4]: {
      return 'REFUND'
    }

    default:
      return 'SWAP'
  }
}

const Template = ({ type, showTypeIcon }: { type: InputType; showTypeIcon: boolean }) => (
  <TxType type={mapType(type)} showTypeIcon={showTypeIcon} />
)
export const Default = Template.bind({})

const argTypes: ArgTypes<{ type: InputType; showTypeIcon: boolean }> = {
  type: {
    control: {
      type: 'select',
      options: types
    }
  },
  showTypeIcon: {
    control: {
      boolean: 'boolean'
    },
    defaultValue: true
  }
}

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/TxType',
  argTypes
}

export default meta
