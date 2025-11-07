import React, { useCallback, useMemo, useRef, useState } from 'react'

import { TRONChain } from '@xchainjs/xchain-tron'
import { Chain, TokenAsset, AssetType } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { getChainAsset } from '../../helpers/chainHelper'
import { emptyString } from '../../helpers/stringHelper'
import { useNetwork } from '../../hooks/useNetwork'
import { useValidateAddress } from '../../hooks/useValidateAddress'
import { EVMChains } from '../../services/evm/const'
import { addAsset } from '../../services/storage/userChainTokens'
import { AssetIcon } from '../uielements/assets/assetIcon'
import { Button, FlatButton } from '../uielements/button'
import { Input } from '../uielements/input'
import { Label } from '../uielements/label'
import { HeadlessModal } from '../uielements/modal/Modal'

// Supported custom token chains (EVM + TRON)
const CustomTokenChains = [...EVMChains, TRONChain]

type Props = {
  open: boolean
  onClose: FP.Lazy<void>
}

export const CustomTokenModal = ({ open, onClose }: Props): JSX.Element => {
  const [contractAddress, setContractAddress] = useState<string>(emptyString)
  const [tokenSymbol, setTokenSymbol] = useState<string>(emptyString)
  const [tokenName, setTokenName] = useState<string>(emptyString)
  const [tokenDecimals, setTokenDecimals] = useState<string>('18')
  const [selectedChain, setSelectedChain] = useState<Chain>(EVMChains[0])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>(emptyString)
  const [decimalsError, setDecimalsError] = useState<string>(emptyString)

  const contractAddressRef = useRef(null)
  const intl = useIntl()
  const { network } = useNetwork()
  const { validateAddress } = useValidateAddress(selectedChain)

  const isEVMChain = (chain: Chain): boolean => {
    return EVMChains.some((evmChain) => evmChain === chain)
  }

  const isValidAddress = useMemo(() => {
    if (!contractAddress) return false
    return validateAddress(contractAddress)
  }, [contractAddress, validateAddress])

  const canAddToken = useMemo(() => {
    return isValidAddress && tokenSymbol.trim() && tokenName.trim() && tokenDecimals && !decimalsError && !isLoading
  }, [isValidAddress, tokenSymbol, tokenName, tokenDecimals, decimalsError, isLoading])

  const handleContractAddressChange = useCallback((value: string) => {
    const trimmedValue = value.trim()
    setContractAddress(trimmedValue)
    setError(emptyString)
  }, [])

  const handleTokenSymbolChange = useCallback((value: string) => {
    setTokenSymbol(value.trim().toUpperCase())
  }, [])

  const handleTokenNameChange = useCallback((value: string) => {
    setTokenName(value.trim())
  }, [])

  const handleTokenDecimalsChange = useCallback((value: string) => {
    setDecimalsError(emptyString)

    if (value === emptyString) {
      setTokenDecimals(value)
      return
    }

    const numericValue = parseInt(value, 10)

    if (isNaN(numericValue) || numericValue < 0) {
      setDecimalsError('Decimals must be a non-negative integer')
      return
    }

    if (numericValue > 255) {
      setDecimalsError('Decimals must be 255 or less')
      return
    }

    setTokenDecimals(numericValue.toString())
  }, [])

  const handleChainChange = useCallback((chain: Chain) => {
    setSelectedChain(chain)
    setContractAddress(emptyString)
    setError(emptyString)
  }, [])

  const clearForm = useCallback(() => {
    setContractAddress(emptyString)
    setTokenSymbol(emptyString)
    setTokenName(emptyString)
    setTokenDecimals('18')
    setError(emptyString)
    setDecimalsError(emptyString)
    setIsLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    clearForm()
    onClose()
  }, [clearForm, onClose])

  const addCustomToken = useCallback(async () => {
    if (!canAddToken) return

    setIsLoading(true)
    setError(emptyString)

    try {
      const customAsset: TokenAsset = {
        chain: selectedChain,
        symbol: `${tokenSymbol}-${contractAddress}`,
        ticker: tokenSymbol,
        type: AssetType.TOKEN
      }

      addAsset(customAsset)

      clearForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add custom token')
    } finally {
      setIsLoading(false)
    }
  }, [canAddToken, selectedChain, tokenSymbol, contractAddress, clearForm, onClose])

  const chainFilter = useMemo(
    () => (
      <div className="flex w-full flex-col px-4 py-4">
        <Label size="big" color="primary">
          {intl.formatMessage({ id: 'settings.custom.token.modal.chain' })}
        </Label>
        <div className="mt-2 flex flex-row space-x-2 overflow-x-auto">
          {CustomTokenChains.map((chain) => (
            <div key={chain} className="cursor-pointer" onClick={() => handleChainChange(chain)}>
              <div
                className={clsx(
                  'flex flex-col items-center',
                  'space-y-2 px-4 py-2',
                  'rounded-lg border border-solid border-bg2 dark:border-bg2d',
                  'hover:bg-bg2 dark:hover:bg-bg2d',
                  { 'bg-bg2 dark:bg-bg2d': selectedChain === chain }
                )}>
                <AssetIcon asset={getChainAsset(chain)} network={network} />
                <span className="text-text2 dark:text-text2d">{chain}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    [intl, selectedChain, network, handleChainChange]
  )

  return (
    <HeadlessModal
      className="h-3/4 max-h-[600px] min-h-[500px]"
      title={intl.formatMessage({ id: 'settings.custom.token.modal.title' })}
      initialFocus={contractAddressRef}
      isOpen={open}
      onClose={handleClose}>
      {chainFilter}

      <div className="flex w-full flex-col space-y-4 px-4">
        <div>
          <Label size="big" color="primary">
            {intl.formatMessage({ id: 'settings.custom.token.modal.address' })}
          </Label>
          <Input
            ref={contractAddressRef}
            className="w-full"
            size="normal"
            value={contractAddress}
            onChange={(e) => handleContractAddressChange(e.target.value)}
            placeholder={
              isEVMChain(selectedChain) ? '0x...' : selectedChain === TRONChain ? 'T...' : 'Contract address'
            }
            error={!!contractAddress && !isValidAddress}
          />
          {contractAddress && !isValidAddress && (
            <Label size="small" color="error">
              {intl.formatMessage({ id: 'settings.custom.token.modal.invalid.address' }, { chain: selectedChain })}
            </Label>
          )}
        </div>

        <div>
          <Label size="big" color="primary">
            {intl.formatMessage({ id: 'settings.custom.token.modal.symbol' })}
          </Label>
          <Input
            className="w-full"
            size="normal"
            value={tokenSymbol}
            onChange={(e) => handleTokenSymbolChange(e.target.value)}
            placeholder="e.g. USDC"
          />
        </div>

        <div>
          <Label size="big" color="primary">
            {intl.formatMessage({ id: 'settings.custom.token.modal.name' })}
          </Label>
          <Input
            className="w-full"
            size="normal"
            value={tokenName}
            onChange={(e) => handleTokenNameChange(e.target.value)}
            placeholder="e.g. USD Coin"
          />
        </div>

        <div>
          <Label size="big" color="primary">
            {intl.formatMessage({ id: 'settings.custom.token.modal.decimals' })}
          </Label>
          <Input
            className="w-full"
            size="normal"
            type="number"
            min="0"
            max="255"
            step="1"
            value={tokenDecimals}
            onChange={(e) => handleTokenDecimalsChange(e.target.value)}
            placeholder="18"
            error={!!decimalsError}
          />
          {decimalsError && (
            <Label size="small" color="error">
              {decimalsError}
            </Label>
          )}
        </div>

        {error && (
          <Label size="normal" color="error">
            {error}
          </Label>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <FlatButton className="min-w-[100px]" color="primary" onClick={handleClose}>
            {intl.formatMessage({ id: 'settings.custom.token.modal.cancel' })}
          </FlatButton>
          <Button
            className="min-w-[100px]"
            color="primary"
            disabled={!canAddToken}
            loading={isLoading}
            onClick={addCustomToken}>
            {intl.formatMessage({ id: 'settings.custom.token.modal.add' })}
          </Button>
        </div>
      </div>
    </HeadlessModal>
  )
}
