import { useCallback, useMemo } from 'react'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useIntl } from 'react-intl'

import type { StreamingMode } from '../../../hooks/useStreamingParams'
import { BaseButton } from '../../uielements/button'
import { Collapse } from '../../uielements/collapse'
import { RadioGroup } from '../../uielements/radioGroup/RadioGroup'
import { Slider } from '../../uielements/slider'
import { Tooltip } from '../../uielements/tooltip'

type Props = {
  activeMode: StreamingMode
  streamingInterval?: number
  streamingQuantity: number
  onModeChange: (mode: StreamingMode) => void
  onQuantityChange: (value: number) => void
  onReset: () => void
  maxStreamingQuantity?: number
  supportRapid?: boolean
}

const MODE_LABEL_KEYS: Record<StreamingMode, string> = {
  0: 'swap.mode.rapid',
  1: 'swap.mode.fast',
  2: 'swap.mode.balanced',
  3: 'swap.mode.bestPrice'
}

export const SwapSettings = ({
  activeMode,
  streamingQuantity,
  onModeChange,
  onQuantityChange,
  onReset,
  maxStreamingQuantity,
  supportRapid = true
}: Props) => {
  const intl = useIntl()

  const modeLabel = intl.formatMessage({ id: MODE_LABEL_KEYS[activeMode] })

  const availableModes: StreamingMode[] = useMemo(() => (supportRapid ? [0, 1, 2, 3] : [1, 2, 3]), [supportRapid])

  const modeOptions = useMemo(
    () =>
      availableModes.map((mode) => ({
        label: <span className="text-[12px]">{intl.formatMessage({ id: MODE_LABEL_KEYS[mode] })}</span>,
        value: mode
      })),
    [intl, availableModes]
  )

  const handleModeChange = useCallback(
    (index: number) => {
      onModeChange(availableModes[index])
    },
    [availableModes, onModeChange]
  )

  const activeIndex = useMemo(() => availableModes.indexOf(activeMode), [availableModes, activeMode])

  const quantityLabel = useMemo(() => {
    return streamingQuantity === 0
      ? [intl.formatMessage({ id: 'swap.settings.subSwaps.auto' })]
      : [intl.formatMessage({ id: 'swap.streaming.quantity' }), `${streamingQuantity}`]
  }, [streamingQuantity, intl])

  return (
    <Collapse
      header={
        <div className="flex flex-row items-center justify-between">
          <span className="m-0 font-main text-[14px] text-text2 dark:text-text2d">
            {intl.formatMessage({ id: 'common.swap' })} {intl.formatMessage({ id: 'common.settings' })} ({modeLabel})
          </span>
        </div>
      }>
      <div className="flex flex-col p-4">
        <div className="flex w-full flex-col space-y-4 px-2">
          <RadioGroup options={modeOptions} activeIndex={activeIndex} onChange={handleModeChange} />
          <Slider
            value={streamingQuantity}
            onChange={onQuantityChange}
            max={maxStreamingQuantity}
            labels={quantityLabel}
          />
        </div>
        <div className="flex justify-end">
          <Tooltip title={intl.formatMessage({ id: 'common.resetToDefault' })}>
            <BaseButton
              onClick={onReset}
              className="rounded-full group-hover:rotate-180 hover:shadow-full dark:hover:shadow-fulld">
              <ArrowPathIcon className="ease h-[25px] w-[25px] text-turquoise" />
            </BaseButton>
          </Tooltip>
        </div>
      </div>
    </Collapse>
  )
}
