import React, { useCallback, useState, useMemo, useRef, Fragment } from 'react'

import { Dialog, Transition } from '@headlessui/react'
import { ArchiveBoxXMarkIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetToString, AssetType, Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { getChainAsset } from '../../../../helpers/chainHelper'
import { eqAsset } from '../../../../helpers/fp/eq'
import { emptyString } from '../../../../helpers/stringHelper'
import { BaseButton } from '../../button'
import { InputSearch } from '../../input'
import { AssetData } from '../assetData'
import { AssetIcon } from '../assetIcon/AssetIcon'

export type Props = {
  asset: AnyAsset
  assets: AnyAsset[]
  onSelect: (_: AnyAsset) => void
  open: boolean
  onClose: FP.Lazy<void>
  className?: string
  headline?: string
  network: Network
}

export const AssetMenu: React.FC<Props> = (props): JSX.Element => {
  const {
    asset,
    open,
    assets = [],
    onSelect = (_: AnyAsset) => {},
    headline = emptyString,
    network,
    onClose,
    className = ''
  } = props

  const [searchValue, setSearchValue] = useState<string>(emptyString)

  const clearSearchValue = useCallback(() => {
    setSearchValue(emptyString)
  }, [])

  const intl = useIntl()

  const handleChangeAsset = useCallback(
    async (asset: AnyAsset) => {
      onSelect(asset)
      clearSearchValue()
    },
    [clearSearchValue, onSelect]
  )

  const filteredAssets = useMemo(
    () =>
      FP.pipe(
        assets,
        A.filter((asset) => {
          if (searchValue) {
            const lowerSearchValue = searchValue.toLowerCase()
            return assetToString(asset).toLowerCase().includes(lowerSearchValue)
          }
          // If there's no search value, return all assets
          return true
        })
      ),
    [assets, searchValue]
  )

  const renderAssets = useMemo(
    () =>
      FP.pipe(
        filteredAssets,
        NEA.fromArray,
        O.fold(
          () => (
            <div className="flex h-full w-full flex-col items-center justify-center px-20px py-50px">
              <ArchiveBoxXMarkIcon className="h-[75px] w-[75px] text-gray0 dark:text-gray0d" />
              <h2 className="mb-10px text-[14px] uppercase text-gray1 dark:text-gray1d">
                {intl.formatMessage({ id: 'common.noResult' })}
              </h2>
            </div>
          ),
          (assets) => (
            <div className="w-[calc(100%-32px)] overflow-y-auto">
              {FP.pipe(
                assets,
                NEA.map((assetInList) => {
                  const selected = eqAsset.equals(asset, assetInList)
                  return (
                    <BaseButton
                      className="w-full !justify-between !pr-20px hover:bg-gray0 hover:dark:bg-gray0d"
                      key={assetToString(assetInList)}
                      onClick={() => handleChangeAsset(assetInList)}
                      disabled={selected}>
                      <AssetData asset={assetInList} network={network} className="" />
                      {selected && <CheckIcon className="h-20px w-20px text-turquoise" />}
                    </BaseButton>
                  )
                })
              )}
            </div>
          )
        )
      ),
    [asset, filteredAssets, handleChangeAsset, intl, network]
  )

  const searchHandler = useCallback(({ target }: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = target
    setSearchValue(value.replace(/\s/g, ''))
  }, [])

  const onEnterHandler = useCallback(() => {
    if (filteredAssets.length === 1) {
      // select first asset
      handleChangeAsset(filteredAssets[0])
    }
  }, [filteredAssets, handleChangeAsset])

  const handleChainSelect = useCallback(
    (chain: Chain) => {
      const asset = getChainAsset(chain)
      handleChangeAsset(asset)
    },
    [handleChangeAsset]
  )

  const onCloseMenu = useCallback(() => {
    clearSearchValue()
    onClose()
  }, [clearSearchValue, onClose])

  const chainFilter = useMemo(() => {
    const uniqueChains = assets.reduce((acc, asset) => {
      // Only add the chain if the asset is not synthetic
      if (asset.type !== AssetType.SYNTH) {
        acc.add(asset.chain)
      }
      return acc
    }, new Set<Chain>())

    // Render unique chains as clickable icons in a horizontal row
    return (
      <div className="flex w-full flex-col px-4 pb-4">
        <h6 className="text-base font-normal text-text2 dark:text-text2d">
          {intl.formatMessage({ id: 'common.asset.quickSelect' })}
        </h6>
        <div className="flex flex-row space-x-2 overflow-x-scroll pb-2">
          {Array.from(uniqueChains).map((chain) => (
            <div key={chain} onClick={() => handleChainSelect(chain)} className="cursor-pointer">
              <div
                className={clsx(
                  'flex flex-col items-center',
                  'space-y-2 px-4 py-2',
                  'rounded-lg border border-solid border-bg2 dark:border-bg2d',
                  'hover:bg-bg2 dark:hover:bg-bg2d'
                )}>
                <AssetIcon asset={getChainAsset(chain)} network={network} />
                <span className="text-text2 dark:text-text2d">{chain}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }, [assets, handleChainSelect, network, intl])

  // Ref to `InputSearch` - needed for intial focus in dialog
  // @see https://headlessui.com/react/dialog#managing-initial-focus
  const inputSearchRef = useRef(null)

  return (
    <Dialog
      as="div"
      className={`relative z-10 ${className}`}
      initialFocus={inputSearchRef}
      open={open}
      onClose={onCloseMenu}>
      <Transition appear show={open} as="div">
        {/* backdrop animated */}
        <Transition.Child
          enter="ease"
          enterFrom="opacity-0"
          enterTo="opacity-70"
          leave="ease"
          leaveFrom="opacity-70"
          leaveTo="opacity-0">
          <div className="ease fixed inset-0 bg-bg0 dark:bg-bg0d" aria-hidden="true" />
        </Transition.Child>

        {/* container to center the panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          {/* dialog panel animated  */}
          <Transition.Child
            as={Fragment}
            enter="ease"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95">
            <Dialog.Panel
              className={clsx(
                'mx-auto flex flex-col items-center py-5',
                'h-3/4 max-h-[600px] min-h-[350px] w-full max-w-[360px] md:max-w-[480px]',
                'bg-bg0 dark:bg-bg0d',
                'rounded-lg border border-solid border-gray1 dark:border-gray0d'
              )}>
              <div className="flex w-full items-center justify-between px-5">
                {headline && (
                  <h1 className="my-0 text-center text-xl uppercase text-text2 dark:text-text2d">{headline}</h1>
                )}
                <BaseButton
                  className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d hover:dark:text-gray2d"
                  onClick={() => onClose()}>
                  <XMarkIcon className="h-20px w-20px text-inherit" />
                </BaseButton>
              </div>
              <div className="my-4 h-[1px] w-full bg-gray1 dark:bg-gray0d" />
              {asset.type !== AssetType.TRADE || (assets.some((a) => a.type !== AssetType.TRADE) && chainFilter)}
              <div className="w-full px-4">
                <InputSearch
                  ref={inputSearchRef}
                  className="w-full"
                  classNameInput="rounded-lg py-2"
                  size="normal"
                  onChange={searchHandler}
                  onCancel={clearSearchValue}
                  onEnter={onEnterHandler}
                  placeholder={intl.formatMessage({ id: 'common.searchAsset' })}
                />
              </div>
              {renderAssets}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Transition>
    </Dialog>
  )
}
