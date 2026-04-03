import { useCallback, useEffect, useState } from 'react'

/**
 * Swap execution modes:
 * 0 = Rapid    — interval=0, qty=0 (auto). Multiple sub-swaps per block. THORChain only.
 * 1 = Streaming — interval=1, qty=user (0=auto). One sub-swap per block, arb rebalancing.
 * 2 = Instant   — interval=1, qty=1. Single swap, one block, no streaming.
 */
export type StreamingMode = 0 | 1 | 2

const MODE_DEFAULTS: Record<StreamingMode, { interval: number; quantity: number }> = {
  0: { interval: 0, quantity: 0 }, // Rapid
  1: { interval: 1, quantity: 0 }, // Streaming (qty=0 means auto)
  2: { interval: 1, quantity: 1 } // Instant
}

const DEFAULT_MODE: StreamingMode = 1 // Streaming

export type UseStreamingParamsReturn = {
  streamingInterval: number
  streamingQuantity: number
  isStreaming: boolean
  activeMode: StreamingMode
  setMode: (mode: StreamingMode) => void
  setInterval: (interval: number) => void
  setQuantity: (quantity: number) => void
  resetToDefault: () => void
  supportRapid: boolean
}

export const useStreamingParams = (supportRapid = true): UseStreamingParamsReturn => {
  const [activeMode, setActiveMode] = useState<StreamingMode>(DEFAULT_MODE)
  const [streamingInterval, setStreamingInterval] = useState<number>(MODE_DEFAULTS[DEFAULT_MODE].interval)
  const [streamingQuantity, setStreamingQuantity] = useState<number>(MODE_DEFAULTS[DEFAULT_MODE].quantity)

  // If rapid is not supported and user has it selected, fall back to streaming
  useEffect(() => {
    if (!supportRapid && activeMode === 0) {
      setActiveMode(DEFAULT_MODE)
      setStreamingInterval(MODE_DEFAULTS[DEFAULT_MODE].interval)
      setStreamingQuantity(MODE_DEFAULTS[DEFAULT_MODE].quantity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportRapid])

  const setMode = useCallback((mode: StreamingMode) => {
    setActiveMode(mode)
    setStreamingInterval(MODE_DEFAULTS[mode].interval)
    setStreamingQuantity(MODE_DEFAULTS[mode].quantity)
  }, [])

  // Only meaningful for Streaming mode — Rapid and Instant have fixed params
  const setInterval = useCallback((interval: number) => {
    setStreamingInterval(interval)
  }, [])

  const setQuantity = useCallback((quantity: number) => {
    setStreamingQuantity(quantity)
  }, [])

  const resetToDefault = useCallback(() => {
    setActiveMode(DEFAULT_MODE)
    setStreamingInterval(MODE_DEFAULTS[DEFAULT_MODE].interval)
    setStreamingQuantity(MODE_DEFAULTS[DEFAULT_MODE].quantity)
  }, [])

  return {
    streamingInterval,
    streamingQuantity,
    isStreaming: activeMode !== 2,
    activeMode,
    setMode,
    setInterval,
    setQuantity,
    resetToDefault,
    supportRapid
  }
}
