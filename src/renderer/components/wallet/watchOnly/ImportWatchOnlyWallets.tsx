import { useCallback, useState } from 'react'

import { EyeIcon, ArrowUpTrayIcon, CheckCircleIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Chain } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { EnabledChain } from '../../../../shared/utils/chain'
import * as walletRoutes from '../../../routes/wallet'
import { useWalletContext } from '../../../contexts/WalletContext'
import { WatchOnlyWallet } from '../../../services/wallet/types'
import { BorderButton, FlatButton } from '../../uielements/button'
import { Input } from '../../uielements/input'
import { Label } from '../../uielements/label'

export const ImportWatchOnlyWallets = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { appWalletService } = useWalletContext()

  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [importedWallets, setImportedWallets] = useState<WatchOnlyWallet[]>([])
  const [importMode, setImportMode] = useState<'file' | 'manual'>('file')
  const [manualAddress, setManualAddress] = useState<string>('')
  const [selectedChain, setSelectedChain] = useState<Chain>('BTC')

  // Common chains for dropdown
  const availableChains: EnabledChain[] = ['BTC', 'ETH', 'THOR', 'BNB', 'LTC', 'BCH', 'DOGE', 'AVAX']

  const handleImportWatchWallets = useCallback(async () => {
    setImportStatus('loading')
    setErrorMessage('')

    try {
      const result = await appWalletService.watchOnlyService.importWatchWallets()

      if (E.isRight(result)) {
        setImportedWallets(result.right)
        setImportStatus('success')

        // Switch to watch-only mode
        appWalletService.switchToWatchOnlyMode()

        // Navigate to wallet assets after successful import
        setTimeout(() => {
          navigate(walletRoutes.assets.path())
        }, 1500)
      } else {
        setErrorMessage(result.left.message)
        setImportStatus('error')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
      setImportStatus('error')
    }
  }, [appWalletService, navigate])

  const handleReturnToWallet = useCallback(() => {
    navigate(walletRoutes.base.path())
  }, [navigate])

  const handleAddManualWallet = useCallback(async () => {
    if (!manualAddress || !selectedChain) {
      setErrorMessage('Please enter both address and chain')
      return
    }

    setImportStatus('loading')
    setErrorMessage('')

    try {
      const watchWallet: WatchOnlyWallet = {
        address: manualAddress,
        chain: selectedChain,
        walletIndex: 0
      }

      appWalletService.watchOnlyService.addWatchWallet(watchWallet)
      appWalletService.switchToWatchOnlyMode()

      setImportedWallets([watchWallet])
      setImportStatus('success')

      // Navigate to wallet assets after successful add
      setTimeout(() => {
        navigate(walletRoutes.assets.path())
      }, 1500)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
      setImportStatus('error')
    }
  }, [manualAddress, selectedChain, appWalletService, navigate])

  // Developer utility to create sample file for testing
  const createSampleFile = useCallback(() => {
    const sampleWallets = [
      {
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        chain: 'BTC',
        walletIndex: 0,
        hdPath: "m/84'/0'/0'/0/0"
      },
      {
        address: '0x742d35cc6635C0532925a3b8D7389B7E3F66C5Ae',
        chain: 'ETH',
        walletIndex: 0,
        hdPath: "m/44'/60'/0'/0/0"
      },
      {
        address: 'thor1xy2kgdygjrsqtzq2n0yrf2493p83kkfj3zpj7h',
        chain: 'THOR',
        walletIndex: 0,
        hdPath: "m/44'/931'/0'/0/0"
      }
    ]

    const fileData = {
      type: 'ASGARDEX_WATCH_WALLET',
      version: '1.0.0',
      data: sampleWallets
    }

    // Download the sample file
    const dataStr = JSON.stringify(fileData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sample_watch_wallets_${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const renderError = (msg: string) => (
    <Label className="font-main mb-20px" color="error" size="normal" textTransform="uppercase">
      {msg}
    </Label>
  )

  const renderSuccess = () => (
    <div className="flex flex-col items-center text-center">
      <CheckCircleIcon className="w-16 h-16 text-turquoise mb-4" />
      <Label className="font-main mb-4" color="primary" size="large">
        {intl.formatMessage({ id: 'wallet.imports.watchOnly.success' })}
      </Label>
      <Label className="font-main mb-4" color="normal" size="normal">
        {intl.formatMessage({ id: 'wallet.imports.watchOnly.imported.count' }, { count: importedWallets.length })}
      </Label>
      {importedWallets.map((wallet, index) => (
        <div key={index} className="mb-2 p-2 bg-gray1 dark:bg-gray1d rounded">
          <div className="text-sm">
            {wallet.chain}: {wallet.address}
          </div>
        </div>
      ))}
    </div>
  )

  if (importStatus === 'success') {
    return (
      <div className="w-full p-8 pt-4">
        <div className="flex flex-col items-center">{renderSuccess()}</div>
      </div>
    )
  }

  const renderFileImport = () => (
    <div className="w-full max-w-lg">
      <Label className="font-main mb-4 text-center" size="normal" color="gray">
        {intl.formatMessage({ id: 'wallet.imports.watchOnly.description' })}
      </Label>

      {/* Import button */}
      <BorderButton
        className="mb-4 cursor-pointer !rounded-lg w-full"
        type="button"
        size="large"
        onClick={handleImportWatchWallets}
        disabled={importStatus === 'loading'}>
        <ArrowUpTrayIcon className="w-4 h-4" />
        <span className="ml-2">
          {importStatus === 'loading'
            ? intl.formatMessage({ id: 'common.loading' })
            : intl.formatMessage({ id: 'wallet.imports.watchOnly.selectFile' })}
        </span>
      </BorderButton>

      {/* Developer utility - Create sample file */}
      <div className="mt-4 pt-4 border-t border-gray1 dark:border-gray1d">
        <Label className="block mb-2 text-xs text-gray2 dark:text-gray2d text-center">
          For Testing: Download Sample File
        </Label>
        <button className="w-full text-xs text-turquoise hover:text-turquoise/80 underline" onClick={createSampleFile}>
          Download sample_watch_wallets.json
        </button>
      </div>
    </div>
  )

  const renderManualInput = () => (
    <div className="w-full max-w-lg">
      <Label className="font-main mb-4 text-center" size="normal" color="gray">
        Enter an address manually to monitor its balance
      </Label>

      {/* Chain selector */}
      <div className="mb-4">
        <Label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">Chain</Label>
        <select
          className="w-full p-3 border border-gray1 dark:border-gray1d bg-bg0 dark:bg-bg0d text-text0 dark:text-text0d rounded-lg"
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value as Chain)}>
          {availableChains.map((chain) => (
            <option key={chain} value={chain}>
              {chain}
            </option>
          ))}
        </select>
      </div>

      {/* Address input */}
      <div className="mb-4">
        <Label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">Address</Label>
        <Input
          size="large"
          placeholder="Enter wallet address..."
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
        />
      </div>

      {/* Add button */}
      <BorderButton
        className="cursor-pointer !rounded-lg w-full"
        type="button"
        size="large"
        onClick={handleAddManualWallet}
        disabled={importStatus === 'loading' || !manualAddress || !selectedChain}>
        <PlusIcon className="w-4 h-4" />
        <span className="ml-2">
          {importStatus === 'loading' ? intl.formatMessage({ id: 'common.loading' }) : 'Add Watch Address'}
        </span>
      </BorderButton>
    </div>
  )

  return (
    <div className="w-full p-8 pt-4">
      <div className="flex flex-col items-center">
        {/* Icon and title */}
        <EyeIcon className="w-16 h-16 text-text2 dark:text-text2d mb-4" />
        <Label className="font-main mb-4 text-center" size="large">
          {intl.formatMessage({ id: 'wallet.imports.watchOnly.title' })}
        </Label>

        {/* Mode toggle buttons */}
        <div className="flex mb-6 bg-bg1 dark:bg-bg1d p-1 rounded-lg">
          <button
            className={`px-4 py-2 rounded-md transition-colors ${
              importMode === 'file'
                ? 'bg-turquoise text-white'
                : 'text-text0 dark:text-text0d hover:bg-bg2 dark:hover:bg-bg2d'
            }`}
            onClick={() => setImportMode('file')}>
            Import File
          </button>
          <button
            className={`px-4 py-2 rounded-md transition-colors ${
              importMode === 'manual'
                ? 'bg-turquoise text-white'
                : 'text-text0 dark:text-text0d hover:bg-bg2 dark:hover:bg-bg2d'
            }`}
            onClick={() => setImportMode('manual')}>
            Manual Entry
          </button>
        </div>

        {/* Error display */}
        {importStatus === 'error' && renderError(errorMessage)}

        {/* Content based on mode */}
        {importMode === 'file' ? renderFileImport() : renderManualInput()}

        {/* Back button */}
        <FlatButton
          className="mt-6 min-w-40"
          size="normal"
          color="warning"
          type="button"
          onClick={handleReturnToWallet}>
          {intl.formatMessage({ id: 'common.back' })}
        </FlatButton>
      </div>
    </div>
  )
}
