import { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { baseToAsset, formatAssetAmountCurrency, baseAmount, formatBN } from '@xchainjs/xchain-util'
import { useIntl } from 'react-intl'

import { WalletType } from '../../../shared/wallet/types'
import { ZERO_BN } from '../../const'
import { isUSDAsset } from '../../helpers/assetHelper'
import { hiddenString } from '../../helpers/stringHelper'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { FixmeType } from '../../types/asgardex'
import { ParentProps } from '../../views/wallet/RunepoolView'
import { Table } from '../table'
import { AssetData } from '../uielements/assets/assetData'
import { ManageButton } from '../uielements/button/ManageButton'
import { Label } from '../uielements/label'
import { InteractType } from '../wallet/txs/interact/Interact.types'

export type RPRow = {
  key: string
  depositValueLabel: string
  withdrawValueLabel: string
  priceDepositLabel: string
  withdrawDepositLabel: string
  growthValue: string
  growthValueLabel: string
  percentLabel: string
  walletType: WalletType
}

export const RunePoolTable = ({ assetDetails }: ParentProps): JSX.Element => {
  const intl = useIntl()
  const isXLargeScreen = useBreakpoint()?.xl ?? false
  const isXXLargeScreen = useBreakpoint()?.xxl ?? false

  const columns: ColumnDef<RPRow, FixmeType>[] = useMemo(
    () => [
      {
        header: intl.formatMessage({ id: 'common.asset' }),
        accessorKey: 'key',
        cell: ({ row }) => {
          const [chain, symbol, walletType] = row.original.key.split('.')
          const assetDetail = assetDetails.find(
            (detail) =>
              detail.asset.chain === chain && detail.asset.symbol === symbol && detail.walletType === walletType
          )
          return assetDetail ? (
            <AssetData asset={assetDetail.asset} size="small" network={assetDetail.network} />
          ) : (
            'N/A'
          )
        },
        enableSorting: false
      },
      {
        header: intl.formatMessage({ id: 'runePool.detail.current.title' }),
        accessorKey: 'priceDepositLabel',
        cell: ({ row }) => <Label align="center">{row.original.priceDepositLabel}</Label>,
        enableSorting: false,
        size: 120
      },
      {
        header: intl.formatMessage({ id: 'runePool.detail.assetAmount' }),
        accessorKey: 'depositValueLabel',
        cell: ({ row }) => <Label align="center">{row.original.depositValueLabel}</Label>,
        enableSorting: false,
        size: 120
      },
      {
        header: intl.formatMessage({ id: 'runePool.detail.redeem.title' }),
        accessorKey: 'withdrawValueLabel',
        cell: ({ row }) => <Label align="center">{row.original.withdrawValueLabel}</Label>,
        enableSorting: false,
        size: 120
      },
      ...(isXXLargeScreen
        ? ([
            {
              header: intl.formatMessage({ id: 'runePool.detail.totalGrowth' }),
              accessorKey: 'withdrawDepositLabel',
              cell: ({ row }) => <Label align="center">{row.original.withdrawDepositLabel}</Label>,
              enableSorting: false,
              size: 120
            },
            {
              header: intl.formatMessage({ id: 'runePool.detail.percent' }),
              accessorKey: 'growthValueLabel',
              cell: ({ row }) => <Label align="center">{row.original.growthValueLabel}</Label>,
              enableSorting: false,
              size: 120
            }
          ] as ColumnDef<RPRow, FixmeType>[])
        : []),
      ...(isXLargeScreen
        ? ([
            {
              header: () => (
                <Label align="center" color="gray">
                  Wallet Type
                </Label>
              ),
              accessorKey: 'walletType',
              cell: ({ row }) => <Label align="center">{row.original.walletType}</Label>,
              enableSorting: false,
              size: 100
            }
          ] as ColumnDef<RPRow, FixmeType>[])
        : []),
      {
        header: () => (
          <Label align="center" color="gray">
            {intl.formatMessage({ id: 'common.manage' })}
          </Label>
        ),
        accessorKey: 'manage',
        cell: () => {
          return (
            <div className="flex items-center justify-center">
              <ManageButton
                variant="runePool"
                interactType={InteractType.RunePool}
                useBorderButton={false}
                isTextView={isXLargeScreen}
              />
            </div>
          )
        },
        enableSorting: false
      }
    ],
    [assetDetails, intl, isXLargeScreen, isXXLargeScreen]
  )

  const dataSource = assetDetails.map(({ asset, deposit, value, priceAsset, percent, walletType, privateData }) => {
    const depositValueLabel = privateData
      ? hiddenString
      : formatAssetAmountCurrency({ amount: baseToAsset(deposit.amount), asset, decimal: 3 })

    const priceDepositLabel = privateData
      ? hiddenString
      : formatAssetAmountCurrency({
          amount: baseToAsset(deposit.price),
          asset: priceAsset,
          decimal: isUSDAsset(priceAsset) ? 2 : 6
        })
    const withdrawValueLabel = privateData
      ? hiddenString
      : formatAssetAmountCurrency({ amount: baseToAsset(value), asset, decimal: 3 })

    const withdrawDepositLabel = privateData
      ? hiddenString
      : formatAssetAmountCurrency({
          amount: baseToAsset(value.minus(deposit.amount)),
          asset: priceAsset,
          decimal: isUSDAsset(priceAsset) ? 2 : 6
        })
    const gV = value.minus(deposit.amount)
    const growthValue = privateData
      ? hiddenString
      : formatAssetAmountCurrency({
          amount: baseToAsset(gV),
          asset: priceAsset,
          decimal: isUSDAsset(priceAsset) ? 2 : 6
        })
    const growthValueLabel = privateData
      ? hiddenString
      : formatAssetAmountCurrency({
          amount: baseToAsset(gV.gt(0) ? gV : baseAmount(0, deposit.amount.decimal)),
          asset,
          decimal: isUSDAsset(asset) ? 2 : 6
        })

    const percentLabel = privateData ? hiddenString : `${formatBN(percent.gt(0) ? percent : ZERO_BN, 4)}%`

    return {
      key: `${asset.chain}.${asset.symbol}.${walletType}`,
      depositValueLabel,
      withdrawValueLabel,
      priceDepositLabel,
      withdrawDepositLabel,
      growthValue,
      growthValueLabel,
      percentLabel,
      walletType
    }
  })

  return <Table loading={false} columns={columns} data={dataSource} />
}
