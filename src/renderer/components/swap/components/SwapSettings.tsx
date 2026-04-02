import { useCallback, useMemo } from 'react'

import { useIntl } from 'react-intl'

import type { StreamingMode } from '../../../hooks/useStreamingParams'
import { Collapse } from '../../uielements/collapse'
import { RadioGroup } from '../../uielements/radioGroup/RadioGroup'
import { Slider } from '../../uielements/slider'

type Props = {
  activeMode: StreamingMode
  streamingInterval: number
  streamingQuantity: number
  onModeChange: (mode: StreamingMode) => void
  onIntervalChange: (interval: number) => void
  onQuantityChange: (value: number) => void
  maxStreamingQuantity?: number
  supportRapid?: boolean
}

const MODE_LABEL_KEYS: Record<StreamingMode, string> = {
  0: 'swap.mode.rapid',
  1: 'swap.mode.streaming',
  2: 'swap.mode.instant'
}

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 blk (~6s)' },
  { value: 2, label: '2 blks (~12s)' },
  { value: 3, label: '3 blks (~18s)' }
]

export const SwapSettings = ({
  activeMode,
  streamingInterval,
  streamingQuantity,
  onModeChange,
  onIntervalChange,
  onQuantityChange,
  maxStreamingQuantity,
  supportRapid = true
}: Props) => {
  const intl = useIntl()

  const modeLabel = intl.formatMessage({ id: MODE_LABEL_KEYS[activeMode] })

  const availableModes: StreamingMode[] = useMemo(() => (supportRapid ? [0, 1, 2] : [1, 2]), [supportRapid])

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

  const intervalOptions = useMemo(
    () =>
      INTERVAL_OPTIONS.map((opt) => ({
        label: <span className="text-[11px]">{opt.label}</span>,
        value: opt.value
      })),
    []
  )

  const activeIntervalIndex = useMemo(
    () => INTERVAL_OPTIONS.findIndex((opt) => opt.value === streamingInterval),
    [streamingInterval]
  )

  const handleIntervalChange = useCallback(
    (index: number) => {
      onIntervalChange(INTERVAL_OPTIONS[index].value)
    },
    [onIntervalChange]
  )

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
          {activeMode === 1 && (
            <>
              <div className="flex flex-col space-y-1">
                <span className="text-[12px] text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'swap.streaming.interval' })}
                </span>
                <RadioGroup
                  options={intervalOptions}
                  activeIndex={activeIntervalIndex}
                  onChange={handleIntervalChange}
                />
              </div>
              <Slider
                value={streamingQuantity}
                onChange={onQuantityChange}
                max={maxStreamingQuantity}
                labels={quantityLabel}
              />
            </>
          )}
        </div>
      </div>
    </Collapse>
  )
}
