import React, { useCallback, useMemo, useRef } from 'react'

import { SliderSingleProps } from 'antd/lib/slider'
import { TooltipPlacement } from 'antd/lib/tooltip'

import { SliderWrapper, SliderLabel } from './Slider.styles'

type CustomProps = {
  tooltipPlacement?: TooltipPlacement
  withLabel?: boolean
  labelPosition?: 'top' | 'bottom'
  error?: boolean
  labels?: string[] // New prop for custom labels
}

type Props = CustomProps & SliderSingleProps

export const Slider: React.FC<Props> = ({
  tooltipPlacement = 'bottom',
  withLabel = false,
  tipFormatter = (value) => `${value}`,
  labelPosition,
  tooltipVisible,
  error = false,
  labels = ['0%', '50%', '100%'], // Default labels, you can modify them
  ...rest
}): JSX.Element => {
  const ref = useRef()
  const getTooltipPopupContainer = useCallback((container: HTMLElement) => container, [])

  const percentLabels = useMemo(
    () => (
      <SliderLabel>
        {labels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </SliderLabel>
    ),
    [labels]
  )

  return (
    <>
      {withLabel && labelPosition === 'top' && percentLabels}
      <SliderWrapper
        ref={ref}
        tooltipPlacement={tooltipPlacement}
        getTooltipPopupContainer={tooltipVisible ? getTooltipPopupContainer : undefined}
        tipFormatter={tipFormatter}
        error={error}
        {...rest}
      />
      {withLabel && labelPosition !== 'top' && percentLabels}
    </>
  )
}
