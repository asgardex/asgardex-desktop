import { useMemo } from 'react'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useIntl } from 'react-intl'

import { BaseButton } from '../../uielements/button'
import { Collapse } from '../../uielements/collapse'
import { Slider } from '../../uielements/slider'
import { Tooltip } from '../../uielements/tooltip'

type Props = {
  slider: number
  streamingInterval: number
  streamingQuantity: number
  onSliderChange: (value: number) => void
  onQuantityChange: (value: number) => void
  onReset: () => void
}

const getModeLabel = (slider: number) => {
  if (slider <= 0) return 'Limit Swap'
  if (slider < 50) return 'Time Optimised'
  return 'Price Optimised'
}

export const SwapSettings = ({
  slider,
  streamingInterval,
  streamingQuantity,
  onSliderChange,
  onQuantityChange,
  onReset
}: Props) => {
  const labelMin = useMemo(() => getModeLabel(slider), [slider])
  const intl = useIntl()

  const quantityLabel = useMemo(() => {
    if (streamingInterval === 0) return ['Limit swap']
    return streamingQuantity === 0 ? ['Auto swap count'] : ['Sub swaps', `${streamingQuantity}`]
  }, [streamingInterval, streamingQuantity])

  return (
    <Collapse
      header={
        <div className="flex flex-row items-center justify-between">
          <span className="m-0 font-main text-[14px] text-text2 dark:text-text2d">
            {intl.formatMessage({ id: 'common.swap' })} {intl.formatMessage({ id: 'common.settings' })} ({labelMin})
          </span>
        </div>
      }>
      <div className="flex flex-col p-4">
        <div className="flex w-full flex-col gap-4 px-2">
          <Slider value={slider} onChange={onSliderChange} max={100} labels={[labelMin, `${streamingInterval}`]} />
          <Slider value={streamingQuantity} onChange={onQuantityChange} labels={quantityLabel} />
        </div>
        <div className="flex justify-end">
          <Tooltip title={intl.formatMessage({ id: 'common.resetToDefault' })}>
            <BaseButton
              onClick={onReset}
              className="rounded-full hover:shadow-full group-hover:rotate-180 dark:hover:shadow-fulld">
              <ArrowPathIcon className="ease h-[25px] w-[25px] text-turquoise" />
            </BaseButton>
          </Tooltip>
        </div>
      </div>
    </Collapse>
  )
}
