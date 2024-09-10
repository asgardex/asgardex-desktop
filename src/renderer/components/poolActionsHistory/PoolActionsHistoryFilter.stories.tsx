import { useState } from 'react'

import { Meta } from '@storybook/react'

import { PoolActionsHistoryFilter } from './PoolActionsHistoryFilter'
import { Filter as FilterType } from './types'

const Template = () => {
  const [filter, setFilter] = useState<FilterType>('ALL')
  return (
    <PoolActionsHistoryFilter
      currentFilter={filter}
      onFilterChanged={setFilter}
      availableFilters={['ALL', 'DEPOSIT', 'SWAP', 'WITHDRAW', 'DONATE', 'REFUND']}
    />
  )
}

export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/PoolActionsHistoryFilter'
}

export default meta
