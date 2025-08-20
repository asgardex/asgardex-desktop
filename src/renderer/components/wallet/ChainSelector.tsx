import React, { useCallback, useEffect } from 'react'
import { ArrowPathIcon, PlayIcon } from '@heroicons/react/24/outline'
import { Chain } from '@xchainjs/xchain-util'

import { BaseButton } from '../uielements/button'
import { Headline } from '../uielements/headline'

interface ChainItemProps {
  chain: Chain
  selected: boolean
  onSelect: (chain: Chain) => void
  onDetectSingle: (chain: Chain) => void
}

const ChainItem: React.FC<ChainItemProps> = ({ chain, selected, onSelect, onDetectSingle }) => {
  const handleSelect = useCallback(() => {
    onSelect(chain)
  }, [chain, onSelect])

  const handleDetectSingle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDetectSingle(chain)
    },
    [chain, onDetectSingle]
  )

  return (
    <div
      className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 hover:border-turquoise ${
        selected
          ? 'border-turquoise bg-turquoise/10 dark:bg-turquoise/5'
          : 'border-gray0 dark:border-gray0d bg-bg1 dark:bg-bg1d'
      }`}
      onClick={handleSelect}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-text1 dark:text-text1d font-medium">{chain}</span>
        </div>
        <div className="flex items-center gap-3">
          <BaseButton
            type="button"
            size="small"
            color="primary"
            onClick={handleDetectSingle}
            className="!px-2 !py-1 text-10">
            <PlayIcon className="w-3 h-3 mr-1" />
            Go
          </BaseButton>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selected ? 'border-turquoise bg-turquoise' : 'border-gray0 dark:border-gray0d bg-transparent'
            }`}>
            {selected && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProgressIndicatorProps {
  currentChain?: Chain
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentChain }) => {
  return (
    <div className="w-full bg-bg2 dark:bg-bg2d rounded-lg p-4">
      <div className="flex items-center justify-center mb-4">
        <span className="text-text2 dark:text-text2d text-14">Detecting device...</span>
      </div>
      <div className="flex items-center justify-center">
        <ArrowPathIcon className="w-6 h-6 mr-2 animate-spin text-turquoise" />
        {currentChain && <span className="text-turquoise text-14 font-medium">Checking {currentChain}...</span>}
      </div>
    </div>
  )
}

interface ChainSelectorProps {
  availableChains: Chain[]
  selectedChain?: Chain
  onSelectionChange: (chain?: Chain) => void
  onStartDetection: () => void
  onDetectSingle: (chain: Chain) => void
  onBack: () => void
  isDetecting: boolean
  detectionProgress?: {
    currentChain?: Chain
  }
  connectedChain?: Chain
  detectionPhase?: string
}

export const ChainSelector: React.FC<ChainSelectorProps> = ({
  availableChains,
  selectedChain,
  onSelectionChange,
  onStartDetection,
  onDetectSingle,
  onBack,
  isDetecting,
  detectionProgress,
  connectedChain,
  detectionPhase
}) => {
  const handleChainSelect = useCallback(
    (chain: Chain) => {
      // If this chain is already selected, deselect it; otherwise select it
      const newSelection = selectedChain === chain ? undefined : chain
      onSelectionChange(newSelection)
    },
    [selectedChain, onSelectionChange]
  )

  const handleStartDetection = useCallback(() => {
    if (selectedChain) {
      onStartDetection()
    }
  }, [selectedChain, onStartDetection])

  // Auto-navigate when detection is completed
  useEffect(() => {
    if (!isDetecting && connectedChain && detectionPhase === 'completed') {
      const timer = setTimeout(() => {
        onBack() // This calls handleDetectionComplete which navigates to assets
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isDetecting, connectedChain, detectionPhase, onBack])

  // Show detection completed state
  if (!isDetecting && connectedChain && detectionPhase === 'completed') {
    return (
      <div className="flex flex-col items-center py-10 px-5 max-w-2xl mx-auto bg-bg0 dark:bg-bg0d min-h-screen">
        <Headline size="large" color="primary" className="mb-4 text-center">
          Ledger Detection Complete
        </Headline>

        <div className="w-full bg-bg1 dark:bg-bg1d rounded-xl p-6 mb-6">
          <div className="text-center mb-4">
            <div className="text-turquoise text-48 mb-2">✓</div>
            <h3 className="text-text1 dark:text-text1d text-18 font-semibold mb-2">Detection Successful</h3>
            <p className="text-text2 dark:text-text2d text-14">Successfully connected to {connectedChain}</p>
          </div>

          <div className="flex justify-center">
            <span className="bg-turquoise text-white px-4 py-2 rounded-lg text-14 font-medium">{connectedChain}</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-text2 dark:text-text2d text-14">Redirecting to wallet...</p>
        </div>
      </div>
    )
  }

  // Show detection in progress state
  if (isDetecting && detectionProgress) {
    return (
      <div className="flex flex-col items-center py-10 px-5 max-w-2xl mx-auto bg-bg0 dark:bg-bg0d min-h-screen">
        <Headline size="large" color="primary" className="mb-4 text-center">
          Detecting Ledger Devices
        </Headline>

        <p className="text-center mb-8 text-text2 dark:text-text2d text-16 leading-relaxed">
          Please ensure your Ledger device is connected and the corresponding apps are open.
        </p>

        <div className="w-full max-w-md">
          <ProgressIndicator {...detectionProgress} />
        </div>

        <div className="mt-8">
          <BaseButton type="button" size="large" onClick={onBack} disabled>
            Cancel Detection
          </BaseButton>
        </div>
      </div>
    )
  }

  // Show chain selection state
  return (
    <div className="flex flex-col items-center py-10 px-5 max-w-2xl mx-auto bg-bg0 dark:bg-bg0d min-h-screen">
      <Headline size="large" color="primary" className="mb-4 text-center">
        Select Chains to Detect
      </Headline>

      <p className="text-center mb-8 text-text2 dark:text-text2d text-16 leading-relaxed">
        Select which blockchain network you want to connect with your Ledger device. Since Ledger devices can only
        connect to one chain at a time, choose carefully.
      </p>

      <div className="w-full max-w-lg mb-6">
        <div className="flex items-center justify-center mb-4">
          <h3 className="text-text1 dark:text-text1d text-16 font-semibold">Available Chains</h3>
        </div>

        <div className="space-y-2">
          {availableChains.map((chain) => (
            <ChainItem
              key={chain}
              chain={chain}
              selected={selectedChain === chain}
              onSelect={handleChainSelect}
              onDetectSingle={onDetectSingle}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <BaseButton type="button" size="large" onClick={onBack}>
          Back
        </BaseButton>
        <BaseButton type="button" size="large" color="primary" onClick={handleStartDetection} disabled={!selectedChain}>
          Detect {selectedChain || 'Chain'}
        </BaseButton>
      </div>
    </div>
  )
}

export default ChainSelector
