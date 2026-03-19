import { useCallback, useState } from 'react'

export type StreamingMode = 0 | 1 | 2 | 3

const MODE_TO_INTERVAL: Record<StreamingMode, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3
}

const DEFAULT_MODE: StreamingMode = 1

export type UseStreamingParamsReturn = {
  streamingInterval: number
  streamingQuantity: number
  isStreaming: boolean
  activeMode: StreamingMode
  setMode: (mode: StreamingMode) => void
  setQuantity: (quantity: number) => void
  resetToDefault: () => void
}

export const useStreamingParams = (): UseStreamingParamsReturn => {
  const [activeMode, setActiveMode] = useState<StreamingMode>(DEFAULT_MODE)
  const [streamingInterval, setStreamingInterval] = useState<number>(MODE_TO_INTERVAL[DEFAULT_MODE])
  const [streamingQuantity, setStreamingQuantity] = useState<number>(0)
  const [isStreaming, setIsStreaming] = useState<boolean>(true)

  const setMode = useCallback((mode: StreamingMode) => {
    setActiveMode(mode)
    setStreamingInterval(MODE_TO_INTERVAL[mode])
    setStreamingQuantity(0)
    setIsStreaming(mode !== 0)
  }, [])

  const setQuantity = useCallback((quantity: number) => {
    setStreamingQuantity(quantity)
  }, [])

  const resetToDefault = useCallback(() => {
    setActiveMode(DEFAULT_MODE)
    setStreamingInterval(MODE_TO_INTERVAL[DEFAULT_MODE])
    setStreamingQuantity(0)
    setIsStreaming(true)
  }, [])

  return {
    streamingInterval,
    streamingQuantity,
    isStreaming,
    activeMode,
    setMode,
    setQuantity,
    resetToDefault
  }
}
