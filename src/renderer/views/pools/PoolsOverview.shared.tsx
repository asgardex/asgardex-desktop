import { ArrowPathIcon, StarIcon as StarOutlined } from '@heroicons/react/24/outline'
import { StarIcon as StarFilled } from '@heroicons/react/24/solid'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { ColumnType } from 'antd/lib/table'
import * as FP from 'fp-ts/function'
import styled from 'styled-components'

import { ErrorView } from '../../components/shared/error'
import { AssetIcon } from '../../components/uielements/assets/assetIcon'
import { AssetLabel } from '../../components/uielements/assets/assetLabel'
import { ReloadButton, TextButton } from '../../components/uielements/button'
import { Label } from '../../components/uielements/label'
import { ordBaseAmount } from '../../helpers/fp/ord'
import { sortByDepth } from '../../helpers/poolHelper'

const RowContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`

const SyncIcon = styled(ArrowPathIcon)<{ icononly: 'true' | 'false' }>`
  width: 16px;
  height: 16px;
  margin-right: ${({ icononly }) => (icononly === 'true' ? '0' : '8px')};
`
const renderWatchColumn = ({
  data: { watched },
  add,
  remove
}: {
  data: { watched: boolean }
  add: FP.Lazy<void>
  remove: FP.Lazy<void>
}) => (
  <div
    className="flex items-center justify-center w-full h-full"
    onClick={(event) => {
      event.preventDefault()
      event.stopPropagation()
      watched ? remove() : add()
    }}>
    {watched ? (
      <StarFilled className="w-5 h-5 stroke-turquoise fill-turquoise" />
    ) : (
      <StarOutlined className="w-5 h-5 stroke-turquoise" />
    )}
  </div>
)

const sortWatchColumn = ({ watched: watchedA }: { watched: boolean }, { watched: watchedB }: { watched: boolean }) =>
  watchedA === watchedB ? 0 : 1

export const watchColumn = <T extends { watched: boolean; asset: AnyAsset }>(
  add: (asset: AnyAsset) => void,
  remove: (asset: AnyAsset) => void
): ColumnType<T> => ({
  key: 'watch',
  align: 'center',
  width: 50,
  render: (data: { watched: boolean; asset: AnyAsset }) =>
    renderWatchColumn({ data, add: () => add(data.asset), remove: () => remove(data.asset) }),
  sorter: sortWatchColumn,
  sortDirections: ['descend', 'ascend']
})

const renderAssetColumn = ({ asset }: { asset: AnyAsset }) => <AssetLabel asset={asset} />

const sortAssetColumn = ({ asset: assetA }: { asset: AnyAsset }, { asset: assetB }: { asset: AnyAsset }) =>
  assetA.symbol.localeCompare(assetB.symbol)

export const assetColumn = <T extends { asset: AnyAsset }>(title: string): ColumnType<T> => ({
  key: 'asset',
  title,
  align: 'left',
  render: renderAssetColumn,
  sorter: sortAssetColumn,
  sortDirections: ['descend', 'ascend']
})

const renderPoolColumn = ({ asset, network }: { asset: AnyAsset; network: Network }) => (
  <RowContainer>
    <AssetIcon asset={asset} network={network} />
  </RowContainer>
)

export const poolColumn = <T extends { network: Network; asset: AnyAsset }>(title: string): ColumnType<T> => ({
  key: 'pool',
  align: 'center',
  title,
  width: 100,
  render: renderPoolColumn
})

const renderPoolColumnMobile = ({ asset, network }: { network: Network; asset: AnyAsset }) => (
  <RowContainer>
    <AssetIcon asset={asset} network={network} />
  </RowContainer>
)

export const poolColumnMobile = <T extends { network: Network; asset: AnyAsset }>(title: string): ColumnType<T> => ({
  key: 'pool',
  title,
  render: renderPoolColumnMobile
})

const renderPriceColumn =
  (pricePoolAsset: AnyAsset) =>
  ({ poolPrice }: { poolPrice: BaseAmount }) =>
    (
      <Label className="!text-16" align="right" nowrap>
        {formatAssetAmountCurrency({
          amount: baseToAsset(poolPrice),
          asset: pricePoolAsset,
          decimal: 3
        })}
      </Label>
    )

const sortPriceColumn = (a: { poolPrice: BaseAmount }, b: { poolPrice: BaseAmount }) =>
  ordBaseAmount.compare(a.poolPrice, b.poolPrice)

export const priceColumn = <T extends { poolPrice: BaseAmount }>(
  title: string,
  pricePoolAsset: AnyAsset
): ColumnType<T> => ({
  key: 'poolprice',
  align: 'right',
  title,
  render: renderPriceColumn(pricePoolAsset),
  sorter: sortPriceColumn,
  sortDirections: ['descend', 'ascend']
})

const renderDepthColumn =
  (pricePoolAsset: AnyAsset) =>
  ({ asset, depthPrice, depthAmount }: { asset: AnyAsset; depthPrice: BaseAmount; depthAmount: BaseAmount }) =>
    (
      <div className="flex flex-col items-end justify-center font-main">
        <div className="whitespace-nowrap text-16 text-text0 dark:text-text0d">
          {formatAssetAmountCurrency({
            amount: baseToAsset(depthAmount),
            asset,
            decimal: 2
          })}
        </div>
        <div className="whitespace-nowrap text-14 text-gray2 dark:text-gray2d">
          {formatAssetAmountCurrency({
            amount: baseToAsset(depthPrice),
            asset: pricePoolAsset,
            decimal: 2
          })}
        </div>
      </div>
    )

export const depthColumn = <T extends { depthPrice: BaseAmount }>(
  title: string,
  pricePoolAsset: AnyAsset
): ColumnType<T> => ({
  key: 'depth',
  align: 'right',
  title,
  render: renderDepthColumn(pricePoolAsset),
  sorter: sortByDepth,
  sortDirections: ['descend', 'ascend'],
  defaultSortOrder: 'descend'
})

export const renderRefreshBtnColTitle = ({
  title,
  clickHandler,
  icononly
}: {
  title: string
  clickHandler: FP.Lazy<void>
  icononly: boolean
}) => (
  <div className="flex items-center justify-center">
    <TextButton size={icononly ? 'large' : 'normal'} onClick={clickHandler} className="">
      <div className="flex items-center">
        <SyncIcon icononly={icononly ? 'true' : 'false'} /> {!icononly && title}
      </div>
    </TextButton>
  </div>
)

export const renderTableError = (reloadBtnLabel: string, reloadBtnAction: FP.Lazy<void>) => (error: Error) =>
  (
    <ErrorView
      title={error?.toString() ?? ''}
      extra={<ReloadButton label={reloadBtnLabel} onClick={reloadBtnAction} />}
    />
  )
