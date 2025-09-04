import React, { useCallback, useMemo, useRef, useState } from 'react'

import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { TokenAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { getChainAsset } from '../../helpers/chainHelper'
import { emptyString } from '../../helpers/stringHelper'
import { useNetwork } from '../../hooks/useNetwork'
import { EVMChains } from '../../services/evm/const'
import { addAsset, removeAsset, getUserAssetsByChain$ } from '../../services/storage/userChainTokens'
import { ARB_TOKEN_WHITELIST } from '../../types/generated/mayachain/arberc20whitelist'
import { AVAX_TOKEN_WHITELIST } from '../../types/generated/thorchain/avaxerc20whitelist'
import { BASE_TOKEN_WHITELIST } from '../../types/generated/thorchain/baseerc20whitelist'
import { BSC_TOKEN_WHITELIST } from '../../types/generated/thorchain/bscerc20whitelist'
import { ETH_TOKEN_WHITELIST } from '../../types/generated/thorchain/etherc20whitelist'
import { AssetData } from '../uielements/assets/assetData'
import { AssetIcon } from '../uielements/assets/assetIcon'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { InputSearch } from '../uielements/input'
import { Label } from '../uielements/label'
import { HeadlessModal } from '../uielements/modal/Modal'

type Props = {
  open: boolean
  onClose: FP.Lazy<void>
}

const getWhitelistAssets = (
  chain: typeof EVMChains[number],
  searchQuery: string,
  checkIsActive: (asset: TokenAsset) => boolean
) => {
  const upperSearchValue = searchQuery.toUpperCase()

  const whitelistMap = {
    [ETHChain]: ETH_TOKEN_WHITELIST,
    [AVAXChain]: AVAX_TOKEN_WHITELIST,
    [BASEChain]: BASE_TOKEN_WHITELIST,
    [BSCChain]: BSC_TOKEN_WHITELIST,
    [ARBChain]: ARB_TOKEN_WHITELIST
  }

  const whitelist = whitelistMap[chain] || []

  return whitelist
    .filter(({ asset }) => asset.symbol.toUpperCase().includes(upperSearchValue))
    .sort((tokenA, tokenB) => {
      const isFirstTokenActive = checkIsActive(tokenA.asset)
      const isSecondTokenActive = checkIsActive(tokenB.asset)

      return Number(isSecondTokenActive) - Number(isFirstTokenActive)
    })
}

export const WhitelistModal = ({ open, onClose }: Props): JSX.Element => {
  const [page, setPage] = useState(1)
  const [searchValue, setSearchValue] = useState<string>(emptyString)
  const [chain, setChain] = useState<typeof EVMChains[number]>(ETHChain)

  const inputSearchRef = useRef(null)
  const intl = useIntl()
  const { network } = useNetwork()

  const chainAssets = useObservableState(
    useMemo(() => getUserAssetsByChain$(chain), [chain]),
    []
  )

  const checkIsActive = useCallback(
    (asset: TokenAsset) => {
      const isExist = chainAssets.find(
        (savedAsset) =>
          savedAsset.chain === asset.chain && savedAsset.symbol.toUpperCase() === asset.symbol.toUpperCase()
      )

      return isExist ? true : false
    },
    [chainAssets]
  )

  const searchHandler = useCallback(({ target }: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = target
    setSearchValue(value.replace(/\s/g, ''))
  }, [])

  const clearSearchValue = useCallback(() => {
    setSearchValue(emptyString)
  }, [])

  const changeChain = useCallback((chain: typeof EVMChains[number]) => {
    setChain(chain)
    setPage(1)
  }, [])

  const whitelistAssets = useMemo(
    () => getWhitelistAssets(chain, searchValue, checkIsActive),
    [chain, searchValue, checkIsActive]
  )

  const chainFilter = useMemo(
    () => (
      <div className="flex w-full flex-col px-4 py-4">
        <div className="flex flex-row space-x-2 overflow-x-auto">
          {EVMChains.map((evmChain) => (
            <div key={evmChain} className="cursor-pointer" onClick={() => changeChain(evmChain)}>
              <div
                className={clsx(
                  'flex flex-col items-center',
                  'space-y-2 px-4 py-2',
                  'rounded-lg border border-solid border-bg2 dark:border-bg2d',
                  'hover:bg-bg2 dark:hover:bg-bg2d',
                  { 'bg-bg2 dark:bg-bg2d': chain === evmChain }
                )}>
                <AssetIcon asset={getChainAsset(evmChain)} network={network} />
                <span className="text-text2 dark:text-text2d">{evmChain}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    [chain, network, changeChain]
  )

  const onToggleAsset = useCallback((active: boolean, asset: TokenAsset) => {
    if (active) addAsset(asset)
    else removeAsset(asset)
  }, [])

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1)
  }, [])

  return (
    <HeadlessModal
      title={intl.formatMessage({ id: 'setting.wallet.whitelist.modal' })}
      initialFocus={inputSearchRef}
      isOpen={open}
      onClose={onClose}>
      <div className="w-full px-4">
        <InputSearch
          ref={inputSearchRef}
          className="w-full"
          classNameInput="rounded-lg py-2"
          size="normal"
          onChange={searchHandler}
          onCancel={clearSearchValue}
          placeholder={intl.formatMessage({ id: 'common.searchAsset' })}
        />
      </div>
      {chainFilter}
      <div className="w-[calc(100%-32px)] overflow-y-auto rounded-lg">
        {whitelistAssets.slice(0, 20 * page).map(({ asset }) => (
          <div
            key={asset.symbol}
            className={clsx(
              'flex items-center justify-between rounded-lg',
              'px-4 py-[3px] pr-5',
              'w-full cursor-pointer text-[14px]',
              'hover:bg-gray0 hover:dark:bg-gray0d'
            )}>
            <AssetData asset={asset} network={Network.Mainnet} />
            <SwitchButton active={checkIsActive(asset)} onChange={(active) => onToggleAsset(active, asset)} />
          </div>
        ))}
        {whitelistAssets.length > 20 * page && (
          <div
            className={clsx(
              'mt-2 flex w-full cursor-pointer items-center justify-center py-2',
              'rounded-lg border border-solid border-bg2 dark:border-bg2d',
              'hover:bg-bg2 dark:hover:bg-bg2d'
            )}
            onClick={handleLoadMore}>
            <Label color="primary" align="center">
              Load More
            </Label>
          </div>
        )}
      </div>
    </HeadlessModal>
  )
}
