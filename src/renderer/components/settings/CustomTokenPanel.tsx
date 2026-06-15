import React, { useCallback, useMemo, useRef, useState } from 'react'

import { TRONChain } from '@xchainjs/xchain-tron'
import { Chain, TokenAsset, AssetType } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { emptyString } from '../../helpers/stringHelper'
import { useValidateAddress } from '../../hooks/useValidateAddress'
import { EVMChains } from '../../services/evm/const'
import { addAsset } from '../../services/storage/userChainTokens'
import { Alert } from '../uielements/alert'
import { ChainIcon } from '../uielements/assets/chainIcon/ChainIcon'
import { FlatButton } from '../uielements/button'
import { Input } from '../uielements/input'
import { Label } from '../uielements/label'

// Supported custom token chains (EVM + TRON)
const CustomTokenChains = [...EVMChains, TRONChain]

export const CustomTokenPanel = (): JSX.Element => {
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

  const handleTokenDecimalsChange = useCallback(
    (value: string) => {
      setDecimalsError(emptyString)

      if (value === emptyString) {
        setTokenDecimals(value)
        return
      }

      const numericValue = parseInt(value, 10)

      if (isNaN(numericValue) || numericValue < 0) {
        setDecimalsError(intl.formatMessage({ id: 'settings.custom.token.modal.decimals.error.invalid' }))
        return
      }

      if (numericValue > 255) {
        setDecimalsError(intl.formatMessage({ id: 'settings.custom.token.modal.decimals.error.max' }))
        return
      }

      setTokenDecimals(numericValue.toString())
    },
    [intl]
  )

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
    } catch (err) {
      setError(err instanceof Error ? err.message : intl.formatMessage({ id: 'settings.custom.token.modal.error.add' }))
    } finally {
      setIsLoading(false)
    }
  }, [canAddToken, selectedChain, tokenSymbol, contractAddress, clearForm, intl])

  const chainFilter = useMemo(
    () => (
      <div className="flex w-full flex-col items-center px-4 py-4">
        <div className="flex flex-row space-x-2 overflow-x-auto">
          {CustomTokenChains.map((chain) => (
            <div key={chain} className="cursor-pointer" onClick={() => handleChainChange(chain)}>
              <div
                className={clsx(
                  'flex flex-col items-center',
                  'space-y-2 px-3 py-2',
                  'rounded-lg border border-solid border-bg2 dark:border-bg2d',
                  'hover:bg-bg2 dark:hover:bg-bg2d',
                  { 'border-turquoise bg-bg2 dark:border-turquoise dark:bg-bg2d': selectedChain === chain }
                )}>
                <ChainIcon chain={chain} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    [selectedChain, handleChainChange]
  )

  return (
    <div className="flex h-[510px] flex-col items-center">
      {chainFilter}

      <div className="flex w-full flex-col space-y-4 px-4">
        <div>
          <Label size="big">{intl.formatMessage({ id: 'settings.custom.token.modal.address' })}</Label>
          <Input
            ref={contractAddressRef}
            className="w-full"
            size="normal"
            value={contractAddress}
            onChange={(e) => handleContractAddressChange(e.target.value)}
            placeholder={
              isEVMChain(selectedChain)
                ? '0x...'
                : selectedChain === TRONChain
                  ? 'T...'
                  : intl.formatMessage({ id: 'settings.custom.token.modal.address.placeholder' })
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
          <Label size="big">{intl.formatMessage({ id: 'settings.custom.token.modal.symbol' })}</Label>
          <Input
            className="w-full"
            size="normal"
            value={tokenSymbol}
            onChange={(e) => handleTokenSymbolChange(e.target.value)}
            placeholder={intl.formatMessage({ id: 'settings.custom.token.modal.symbol.placeholder' })}
          />
        </div>

        <div>
          <Label size="big">{intl.formatMessage({ id: 'settings.custom.token.modal.name' })}</Label>
          <Input
            className="w-full"
            size="normal"
            value={tokenName}
            onChange={(e) => handleTokenNameChange(e.target.value)}
            placeholder={intl.formatMessage({ id: 'settings.custom.token.modal.name.placeholder' })}
          />
        </div>

        <div>
          <Label size="big">{intl.formatMessage({ id: 'settings.custom.token.modal.decimals' })}</Label>
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

        <div className="flex justify-end space-x-2 pt-2">
          <FlatButton
            className="w-full rounded-md"
            color="primary"
            size="large"
            disabled={!canAddToken}
            loading={isLoading}
            onClick={addCustomToken}>
            {intl.formatMessage({ id: 'settings.custom.token.modal.add' })}
          </FlatButton>
        </div>
        <div>
          <Alert type="warning" description="" />
        </div>
      </div>
    </div>
  )
}
