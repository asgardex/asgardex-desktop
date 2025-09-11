import React, { useCallback, useEffect, useState } from 'react'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { Network } from '@xchainjs/xchain-client'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import {
  getChainDerivationPath,
  getChainDerivationOptions,
  chainSupportsMultipleDerivationPaths
} from '../../../shared/utils/derivationPath'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { AssetIcon } from '../../components/uielements/assets/assetIcon'
import { FlatButton } from '../../components/uielements/button'
import { BackLinkButton } from '../../components/uielements/button/BackLinkButton'
import { Dropdown } from '../../components/uielements/dropdown'
import { Headline } from '../../components/uielements/headline'
import { Input } from '../../components/uielements/input'
import { Label } from '../../components/uielements/label'
import { Spin } from '../../components/uielements/spin'
import { useWalletContext } from '../../contexts/WalletContext'
import {
  getChainAsset,
  isBtcChain,
  isBchChain,
  isLtcChain,
  isDogeChain,
  isDashChain,
  isCosmosChain,
  isThorChain,
  isMayaChain,
  isKujiChain
} from '../../helpers/chainHelper'
import { isEvmChain } from '../../helpers/evmHelper'
import { useNetwork } from '../../hooks/useNetwork'
import * as walletRoutes from '../../routes/wallet'
import { isStandaloneLedgerMode } from '../../services/wallet/types'

// Check if chain supports HD modes or wallet index/account configuration
const chainSupportsHDModes = (chain: Chain): boolean => {
  // EVM chains support HD modes
  if (isEvmChain(chain)) return true

  // UTXO chains support HD modes
  if (isBtcChain(chain) || isBchChain(chain) || isLtcChain(chain) || isDogeChain(chain) || isDashChain(chain))
    return true

  // Cosmos-based chains support HD modes
  if (isCosmosChain(chain) || isThorChain(chain) || isMayaChain(chain) || isKujiChain(chain)) return true

  return false
}

interface ChainItemProps {
  chain: Chain
  isSelected: boolean
  onSelect: (chain: Chain) => void
  network: Network
}

const ChainItem: React.FC<ChainItemProps> = ({ chain, isSelected, onSelect, network }) => {
  const handleClick = useCallback(() => {
    onSelect(chain)
  }, [chain, onSelect])

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-3 p-4 rounded-lg border transition-all cursor-pointer',
        'hover:border-turquoise hover:bg-gray0/10 dark:hover:bg-gray0d/10',
        isSelected
          ? 'border-turquoise bg-turquoise/10 dark:bg-turquoise/5'
          : 'border-gray0 dark:border-gray0d bg-bg1 dark:bg-bg1d'
      )}>
      <AssetIcon asset={getChainAsset(chain)} network={network} size="small" />
      <span className="text-text1 dark:text-text1d font-medium text-16">{chain}</span>
    </button>
  )
}

export const LedgerChainSelectView: React.FC = () => {
  const intl = useIntl()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { appWalletService, reloadBalancesByChain, reloadBalances } = useWalletContext()
  const { network } = useNetwork()

  const [selectedChain, setSelectedChain] = useState<Chain | undefined>(undefined)
  const [selectedHDMode, setSelectedHDMode] = useState<HDMode>('default')
  const [walletAccount, setWalletAccount] = useState<number>(0)
  const [walletIndex, setWalletIndex] = useState<number>(0)

  // Get current app wallet state and standalone ledger state
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const standaloneLedgerState = useObservableState(appWalletService.standaloneLedgerService.standaloneLedgerState$)

  // Check if we're coming from "Change Chain" button
  const isChangingChain = searchParams.get('changeChain') === 'true'

  // Initialize standalone ledger mode when mounting
  useEffect(() => {
    // Only switch to standalone ledger mode if not already in it
    if (!appWalletState || !isStandaloneLedgerMode(appWalletState)) {
      appWalletService.switchToStandaloneLedgerMode()
    }
  }, [appWalletService, appWalletState])

  const handleChainSelect = useCallback((chain: Chain) => {
    setSelectedChain(chain)
    // Set appropriate default HD mode based on chain
    if (!chainSupportsHDModes(chain)) {
      setSelectedHDMode('default')
    } else if (chain === BTCChain) {
      // Default to Native SegWit for Bitcoin
      setSelectedHDMode('p2wpkh')
    } else if (chain === BCHChain || chain === LTCChain || chain === DOGEChain || chain === DASHChain) {
      // Other UTXO chains use default mode
      setSelectedHDMode('default')
    } else if (chain === 'GAIA' || chain === 'THOR') {
      // Cosmos chains use default mode
      setSelectedHDMode('default')
    } else {
      // Default to Ledger Live for EVM chains
      setSelectedHDMode('ledgerlive')
    }
  }, [])

  const handleStartDetection = useCallback(async () => {
    if (!selectedChain) return

    try {
      // Set the selected chain, HD mode, and wallet parameters
      appWalletService.standaloneLedgerService.setSelectedChainForDetection(selectedChain)
      appWalletService.standaloneLedgerService.setDetectionHDMode(selectedHDMode)
      appWalletService.standaloneLedgerService.setDetectionWalletParams(walletAccount, walletIndex)

      await appWalletService.standaloneLedgerService.startDetection()
    } catch (error) {
      console.error('Error during single chain detection for chain:', selectedChain, error)
    }
  }, [selectedChain, selectedHDMode, walletAccount, walletIndex, appWalletService.standaloneLedgerService])

  const handleDetectionComplete = useCallback(async () => {
    try {
      const connectedChain = standaloneLedgerState?.connectedChain

      if (connectedChain) {
        appWalletService.standaloneLedgerService.setSelectedChain(connectedChain)

        // Trigger balance reload for the detected chain
        reloadBalancesByChain(connectedChain, WalletType.Ledger)()

        // Also trigger a general balance reload to ensure all balances are refreshed
        reloadBalances()
      }

      // Navigate to assets page without any URL parameters
      navigate(walletRoutes.assets.path(), { replace: true })
    } catch (error) {
      console.error('Error completing standalone ledger setup:', error)
    }
  }, [appWalletService, navigate, standaloneLedgerState?.connectedChain, reloadBalancesByChain, reloadBalances])

  // Auto-redirect immediately when detection is completed
  useEffect(() => {
    if (standaloneLedgerState?.detectionPhase === 'completed' && standaloneLedgerState?.connectedChain) {
      // Redirect immediately without timer
      handleDetectionComplete()
    }
  }, [standaloneLedgerState?.detectionPhase, standaloneLedgerState?.connectedChain, handleDetectionComplete])

  // If user is already in standalone ledger mode and has completed detection, redirect to wallet
  // UNLESS they're changing chains
  if (
    appWalletState &&
    isStandaloneLedgerMode(appWalletState) &&
    standaloneLedgerState?.detectionPhase === 'completed' &&
    standaloneLedgerState?.connectedChain &&
    !isChangingChain
  ) {
    return <Navigate to={walletRoutes.assets.path()} replace />
  }

  // Show chain selector (wait for state to be initialized)
  if (!standaloneLedgerState) {
    return null // Or a loading indicator
  }

  // Detection in progress state
  if (standaloneLedgerState.detectionPhase === 'detecting') {
    return (
      <div className="flex flex-col min-h-screen bg-bg0 dark:bg-bg0d">
        <div className="px-6 py-4">
          <BackLinkButton />
        </div>

        <div className="flex-1 px-6 pt-8">
          <div className="w-full max-w-2xl mx-auto">
            <Headline size="large" color="primary" className="mb-8 text-center">
              {intl.formatMessage({ id: 'ledger.detect.title' })}
            </Headline>

            <Spin
              className="min-h-24 border border-gray0 dark:border-gray0d rounded-lg mb-6"
              spinning={true}
              tip={
                standaloneLedgerState.detectionProgress?.currentChain
                  ? intl.formatMessage(
                      { id: 'ledger.detect.checking' },
                      { chain: standaloneLedgerState.detectionProgress.currentChain }
                    )
                  : intl.formatMessage({ id: 'common.loading' })
              }
            />

            <div className="text-center space-y-3">
              <p className="text-text2 dark:text-text2d text-14">
                {standaloneLedgerState.detectionProgress?.currentChain
                  ? intl.formatMessage(
                      { id: 'ledger.needsconnected' },
                      { chain: standaloneLedgerState.detectionProgress.currentChain }
                    )
                  : intl.formatMessage({ id: 'ledger.connect.instructions' })}
              </p>
              <p className="text-text2 dark:text-text2d text-12 opacity-75">
                Make sure to open the {standaloneLedgerState.detectionProgress?.currentChain || 'required'} app on your
                Ledger device
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Chain selection state
  return (
    <div className="flex flex-col min-h-screen bg-bg0 dark:bg-bg0d">
      <div className="px-6 py-4">
        <BackLinkButton />
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pb-6">
        <div className="w-full max-w-2xl">
          <Headline size="large" color="primary" className="mb-2 text-center">
            {intl.formatMessage({ id: 'ledger.connect.title' })}
          </Headline>

          <p className="text-center text-text2 dark:text-text2d text-16 mb-8">
            {intl.formatMessage({ id: 'ledger.connect.instruction' })}
          </p>

          {/* Chain grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
            {standaloneLedgerState.availableChains.map((chain) => (
              <ChainItem
                key={chain}
                chain={chain}
                isSelected={selectedChain === chain}
                onSelect={handleChainSelect}
                network={network}
              />
            ))}
          </div>

          {/* Wallet configuration for chains that support HD modes */}
          {selectedChain && chainSupportsHDModes(selectedChain) && (
            <div className="flex justify-center mb-4">
              <div className="bg-bg1 dark:bg-bg1d rounded-lg p-4 inline-flex items-center gap-4">
                {/* Account input */}
                <div className="flex items-center gap-2">
                  <Label size="small" className="text-12 uppercase text-gray2 dark:text-gray2d">
                    {intl.formatMessage({ id: 'settings.wallet.account' })}
                  </Label>
                  <Input
                    type="number"
                    value={walletAccount.toString()}
                    onChange={(e) => setWalletAccount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 h-8 text-13 px-2 text-center border border-gray0 dark:border-gray0d rounded"
                    min="0"
                  />
                </div>

                {/* Index input */}
                <div className="flex items-center gap-2">
                  <Label size="small" className="text-12 uppercase text-gray2 dark:text-gray2d">
                    {intl.formatMessage({ id: 'settings.wallet.index' })}
                  </Label>
                  <Input
                    type="number"
                    value={walletIndex.toString()}
                    onChange={(e) => setWalletIndex(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 h-8 text-13 px-2 text-center border border-gray0 dark:border-gray0d rounded"
                    min="0"
                  />
                </div>

                {/* Derivation path dropdown for chains with multiple paths */}
                {chainSupportsMultipleDerivationPaths(selectedChain) && !isEvmChain(selectedChain) && (
                  <div className="min-w-[280px] text-center">
                    <Dropdown
                      trigger={
                        <Label className="rounded-lg px-3 py-2 border border-solid border-bg2 dark:border-bg2d cursor-pointer hover:bg-gray0/10 dark:hover:bg-gray0d/10">
                          {getChainDerivationOptions(selectedChain, walletAccount, walletIndex, network)[
                            selectedHDMode === 'p2tr' ? 1 : 0
                          ]?.description || 'Default'}
                        </Label>
                      }
                      options={getChainDerivationOptions(selectedChain, walletAccount, walletIndex, network).map(
                        (option, index: number) => (
                          <Label
                            key={option.path}
                            className="px-3 py-2 cursor-pointer hover:bg-gray0/10 dark:hover:bg-gray0d/10"
                            size="normal"
                            onClick={() => setSelectedHDMode(index === 0 ? 'p2wpkh' : 'p2tr')}>
                            {option.description}
                          </Label>
                        )
                      )}
                    />
                  </div>
                )}

                {/* Derivation path display for chains with single path */}
                {!chainSupportsMultipleDerivationPaths(selectedChain) && !isEvmChain(selectedChain) && (
                  <div className="min-w-[280px] text-center">
                    <Label className="rounded-lg px-3 py-2 border border-solid border-bg2 dark:border-bg2d text-12 inline-block">
                      {getChainDerivationPath(selectedChain, walletAccount, walletIndex, network).description}
                    </Label>
                  </div>
                )}

                {/* Derivation path dropdown for EVM chains */}
                {isEvmChain(selectedChain) && (
                  <div className="min-w-[280px] text-center">
                    <Dropdown
                      trigger={
                        <Label className="rounded-lg px-3 py-2 border border-solid border-bg2 dark:border-bg2d cursor-pointer hover:bg-gray0/10 dark:hover:bg-gray0d/10">
                          {
                            getChainDerivationPath(selectedChain, walletAccount, walletIndex, undefined, selectedHDMode)
                              .description
                          }
                        </Label>
                      }
                      options={(['ledgerlive', 'legacy', 'metamask'] as const).map((mode) => (
                        <Label
                          key={mode}
                          className="px-3 py-2 cursor-pointer hover:bg-gray0/10 dark:hover:bg-gray0d/10"
                          size="normal"
                          onClick={() => setSelectedHDMode(mode as HDMode)}>
                          {
                            getChainDerivationPath(selectedChain, walletAccount, walletIndex, undefined, mode)
                              .description
                          }
                        </Label>
                      ))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connect button */}
          <div className="flex justify-center">
            <FlatButton
              type="button"
              size="large"
              color="primary"
              onClick={handleStartDetection}
              disabled={!selectedChain}
              className="min-w-[200px]">
              {selectedChain
                ? intl.formatMessage({ id: 'ledger.connect.chain' }, { chain: selectedChain })
                : intl.formatMessage({ id: 'ledger.connect.select' })}
            </FlatButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LedgerChainSelectView
