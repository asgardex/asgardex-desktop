import React, { useMemo } from 'react'

import { Progress } from 'antd' // Import the Ant Design Progress and Tooltip components
import { ProgressProps } from 'antd/lib/progress'
import { TooltipPlacement } from 'antd/lib/tooltip'

import { ProgressWrapper, ProgressLabel } from './Progress.styles'

type CustomProps = {
  tooltipPlacement?: TooltipPlacement
  withLabel?: boolean
  labelPosition?: 'top' | 'bottom'
  hasError?: boolean
  labels?: string[] // New prop for custom labels
  customInfo?: string
}

type Props = CustomProps & ProgressProps

export const ProgressBar: React.FC<Props> = ({
  percent = 10, //default
  withLabel = false,
  labelPosition,
  labels = ['0%', '50%', '100%'], // Default labels
  strokeLinecap = 'round',
  customInfo = 'info',
  showInfo = false,
  ...rest
}): JSX.Element => {
  const percentLabels = useMemo(
    () => (
      <ProgressLabel>
        {labels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </ProgressLabel>
    ),
    [labels]
  )

  return (
    <>
      {withLabel && labelPosition === 'top' && percentLabels}
      <ProgressWrapper
        percent={percent}
        strokeLinecap={strokeLinecap}
        showInfo={showInfo}
        strokeColor={{ from: '#F3BA2F', to: '#23DCC8' }}>
        {' '}
        {/* Wrap the Progress component with Tooltip */}
        <Progress {...rest} percent={percent} format={() => customInfo} />
      </ProgressWrapper>
      {withLabel && labelPosition !== 'top' && percentLabels}
    </>
  )
}
