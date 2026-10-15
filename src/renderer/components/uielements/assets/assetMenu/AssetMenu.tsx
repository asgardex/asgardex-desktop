import React, { useCallback, useState, useMemo, useRef } from 'react'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { ArchiveBoxXMarkIcon, CheckIcon, StarIcon as StarOutlineIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetToString, isSecuredAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { assetChainTicker } from '../../../../helpers/assetHelper'
import { eqAsset } from '../../../../helpers/fp/eq'
import { emptyString } from '../../../../helpers/stringHelper'
import { BaseButton, FilterButton } from '../../button'
import { InputSearch } from '../../input'
import { AssetData } from '../assetData'
import { arrangeAssetsForMenu, ExtendedAssetType, filterButtons } from './AssetMenu.helper'

export type Props = {
  asset: AnyAsset
  assets: AnyAsset[]
  onSelect: (_: AnyAsset) => void
  open: boolean
  onClose: () => void
  className?: string
  headline?: string
  network: Network
  /** Starred assets, in the order they were added. */
  favourites?: AnyAsset[]
  onToggleFavourite?: (asset: AnyAsset) => void
}

export { ExtendedAssetType, filterButtons } from './AssetMenu.helper'

export const AssetMenu = (props: Props): JSX.Element => {
  const {
    asset,
    open,
    assets = [],
    onSelect = (_: AnyAsset) => {},
    headline = emptyString,
    network,
    onClose,
    className = '',
    favourites = [],
    onToggleFavourite = () => {}
  } = props

  const [searchValue, setSearchValue] = useState<string>(emptyString)
  const [activeFilter, setActiveFilter] = useState(ExtendedAssetType.All)

  const clearSearchValue = useCallback(() => {
    setSearchValue(emptyString)
  }, [])

  const intl = useIntl()

  const handleChangeAsset = useCallback(
    (next: AnyAsset) => {
      onSelect(next)
      clearSearchValue()
    },
    [clearSearchValue, onSelect]
  )

  const arrangement = useMemo(
    () => arrangeAssetsForMenu(assets, searchValue, activeFilter, favourites),
    [activeFilter, assets, favourites, searchValue]
  )

  const visibleAssets = useMemo(
    () => (arrangement.kind === 'flat' ? arrangement.assets : [...arrangement.favourites, ...arrangement.rest]),
    [arrangement]
  )

  const favouriteName = useCallback(
    (assetInList: AnyAsset) => {
      const name = assetChainTicker(assetInList)
      return isSecuredAsset(assetInList) ? `${name} ${intl.formatMessage({ id: 'common.asset.secured' })}` : name
    },
    [intl]
  )

  const renderRow = (assetInList: AnyAsset) => {
    const selected = eqAsset.equals(asset, assetInList)
    const isFavourite = favourites.some((favourite) => eqAsset.equals(favourite, assetInList))

    return (
      <div
        key={assetToString(assetInList)}
        className="flex w-full items-center rounded-lg pr-3 hover:bg-gray0 dark:hover:bg-gray0d">
        <BaseButton
          className={clsx(
            '!h-8 !w-8 shrink-0 !p-0',
            isFavourite ? 'text-turquoise' : 'text-gray1 hover:text-turquoise dark:text-gray1d'
          )}
          aria-pressed={isFavourite}
          aria-label={intl.formatMessage(
            { id: isFavourite ? 'common.asset.removeFavourite' : 'common.asset.addFavourite' },
            { asset: favouriteName(assetInList) }
          )}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleFavourite(assetInList)
          }}>
          {isFavourite ? (
            <StarSolidIcon className="h-[18px] w-[18px]" />
          ) : (
            <StarOutlineIcon className="h-[18px] w-[18px]" />
          )}
        </BaseButton>
        <BaseButton
          className="min-w-0 flex-1 !justify-between rounded-lg !pr-2"
          onClick={() => handleChangeAsset(assetInList)}
          disabled={selected}>
          <AssetData asset={assetInList} network={network} />
          {selected && <CheckIcon className="h-20px w-20px shrink-0 text-turquoise" />}
        </BaseButton>
      </div>
    )
  }

  const renderSection = (title: string, rows: AnyAsset[]) => (
    <div>
      <div className="flex items-baseline gap-2 px-2 pt-2 text-base text-text2 dark:text-text2d">
        {title}
        <span className="text-[13px] text-gray1 dark:text-gray1d">{rows.length}</span>
      </div>
      {rows.map(renderRow)}
    </div>
  )

  const renderEmpty = (favouriteEmpty: boolean) => (
    <div className="flex h-full w-[calc(100%-32px)] flex-col items-center justify-center rounded-lg border border-solid border-gray0 px-20px py-50px dark:border-gray0d">
      <ArchiveBoxXMarkIcon className="h-[75px] w-[75px] text-gray0 dark:text-gray0d" />
      <h2 className="mb-10px text-[14px] text-gray1 uppercase dark:text-gray1d">
        {intl.formatMessage({ id: favouriteEmpty ? 'common.asset.noFavourites' : 'common.noResult' })}
      </h2>
      {favouriteEmpty && (
        <p className="mb-0 text-center text-[13px] text-gray1 normal-case dark:text-gray1d">
          {intl.formatMessage({ id: 'common.asset.noFavouritesHint' })}
        </p>
      )}
    </div>
  )

  const renderAssets = (() => {
    if (arrangement.kind === 'flat' && arrangement.assets.length === 0) {
      const favouriteEmpty = activeFilter === ExtendedAssetType.Favorite && !searchValue.trim()
      return renderEmpty(favouriteEmpty)
    }

    const body =
      arrangement.kind === 'sections' ? (
        <>
          {renderSection(intl.formatMessage({ id: 'common.asset.favourites' }), arrangement.favourites)}
          {arrangement.rest.length > 0 && (
            <>
              <div className="mx-2 my-1.5 h-px bg-gray0 dark:bg-gray0d" />
              {renderSection(intl.formatMessage({ id: 'common.asset.allAssets' }), arrangement.rest)}
            </>
          )}
        </>
      ) : (
        arrangement.assets.map(renderRow)
      )

    return (
      <div className="w-[calc(100%-32px)] overflow-y-auto rounded-lg border border-solid border-gray0 p-1 dark:border-gray0d">
        {body}
      </div>
    )
  })()

  const searchHandler = useCallback(({ target }: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = target
    setSearchValue(value.replace(/\s/g, ''))
  }, [])

  const onEnterHandler = useCallback(() => {
    if (visibleAssets.length === 1) {
      handleChangeAsset(visibleAssets[0])
    }
  }, [handleChangeAsset, visibleAssets])

  const onCloseMenu = useCallback(() => {
    clearSearchValue()
    setActiveFilter(ExtendedAssetType.All)
    onClose()
  }, [clearSearchValue, onClose])

  // Ref to `InputSearch` - needed for initial focus in dialog
  // @see https://headlessui.com/react/dialog#managing-initial-focus
  const inputSearchRef = useRef(null)

  return (
    <Dialog
      as="div"
      className={clsx('relative z-[60]', className)}
      initialFocus={inputSearchRef}
      transition
      open={open}
      onClose={onCloseMenu}>
      {/* container to center the panel */}
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className={clsx(
            'mx-auto flex flex-col items-center py-5',
            'h-3/4 max-h-[600px] min-h-[350px] w-full max-w-[360px] md:max-w-[480px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray1 dark:border-gray0d'
          )}>
          <div className="flex w-full items-center justify-between px-5">
            {headline && <h1 className="my-0 text-center text-xl text-text2 uppercase dark:text-text2d">{headline}</h1>}
            <BaseButton
              className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d dark:hover:text-gray2d"
              onClick={onCloseMenu}>
              <XMarkIcon className="h-20px w-20px text-inherit" />
            </BaseButton>
          </div>
          <div className="my-4 h-[2px] w-full bg-gray1 dark:bg-gray0d" />
          <div className="w-full px-4">
            <InputSearch
              ref={inputSearchRef}
              className="w-full"
              classNameInput="rounded-lg !p-2"
              size="normal"
              onChange={searchHandler}
              onCancel={clearSearchValue}
              onEnter={onEnterHandler}
              placeholder={intl.formatMessage({ id: 'common.searchAsset' })}
            />
          </div>
          <div className="my-2 flex w-full flex-wrap px-4">
            {filterButtons.map(({ type, label }) => (
              <FilterButton key={type} active={activeFilter === type} onClick={() => setActiveFilter(type)}>
                {intl.formatMessage({ id: label })}
              </FilterButton>
            ))}
          </div>
          {renderAssets}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
