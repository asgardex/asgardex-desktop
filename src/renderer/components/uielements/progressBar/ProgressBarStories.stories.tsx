import React, { useState } from 'react'

import { ComponentMeta } from '@storybook/react'

import { ProgressBar as Component } from './index'

const labels = ['0%', '50%', '100%'] // Custom labels

const style: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '300px'
}

const Template = () => {
  const [currentValue] = useState(50)
  return (
    <div style={style}>
      <p>currentValue {currentValue}</p>
      <Component percent={currentValue} customInfo={''} />
      <Component percent={currentValue} withLabel labels={labels} customInfo={''} />
      <Component percent={currentValue} withLabel labels={labels} customInfo={''} />
    </div>
  )
}

export const Default = Template.bind({})

const meta: ComponentMeta<typeof Template> = {
  component: Template,
  title: 'Components/ProgressBar'
}

export default meta
