import { useMemo, useCallback } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { baseToAsset, formatAssetAmountCurrency, baseAmount, formatBN } from '@xchainjs/xchain-util'
import { option as O, nonEmptyArray as NEA } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { WalletType } from '../../../shared/wallet/types'
import { ZERO_BN } from '../../const'
import { isUSDAsset } from '../../helpers/assetHelper'
import { hiddenString } from '../../helpers/stringHelper'
import { getWalletBalanceByAssetAndWalletType } from '../../helpers/walletHelper'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import * as walletRoutes from '../../routes/wallet'
import { setSelectedAsset } from '../../services/wallet'
import { FixmeType } from '../../types/asgardex'
import { ParentProps } from '../../views/wallet/ProtocolPoolView'
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
  chain: string
}

export const ProtocolPoolTable = ({ assetDetails, allBalances }: ParentProps): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const isXLargeScreen = useBreakpoint()?.xl ?? false
  const isXXLargeScreen = useBreakpoint()?.xxl ?? false

  const handleManageClick = useCallback(
    (chain: string, walletType: WalletType, interactType: InteractType) => {
      // Determine asset based on chain
      const asset = chain === 'MAYA' ? AssetCacao : AssetRuneNative

      const oWalletBalances = NEA.fromArray(allBalances)
      const walletBalance = getWalletBalanceByAssetAndWalletType({
        oWalletBalances,
        asset,
        walletType
      })

      if (O.isSome(walletBalance)) {
        const selectedAsset = {
          asset: walletBalance.value.asset,
          walletAddress: walletBalance.value.walletAddress,
          walletType: walletBalance.value.walletType,
          walletAccount: walletBalance.value.walletAccount,
          walletIndex: walletBalance.value.walletIndex,
          hdMode: walletBalance.value.hdMode
        }
        setSelectedAsset(O.some(selectedAsset))
      }

      // Navigate to interact route
      navigate(walletRoutes.interact.path({ interactType }))
    },
    [navigate, allBalances]
  )

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
        header: intl.formatMessage({ id: 'protocolPool.detail.current.title' }),
        accessorKey: 'priceDepositLabel',
        cell: ({ row }) => <Label align="center">{row.original.priceDepositLabel}</Label>,
        enableSorting: false,
        size: 120
      },
      {
        header: intl.formatMessage({ id: 'protocolPool.detail.assetAmount' }),
        accessorKey: 'depositValueLabel',
        cell: ({ row }) => <Label align="center">{row.original.depositValueLabel}</Label>,
        enableSorting: false,
        size: 120
      },
      {
        header: intl.formatMessage({ id: 'protocolPool.detail.redeem.title' }),
        accessorKey: 'withdrawValueLabel',
        cell: ({ row }) => <Label align="center">{row.original.withdrawValueLabel}</Label>,
        enableSorting: false,
        size: 120
      },
      ...(isXXLargeScreen
        ? ([
            {
              header: intl.formatMessage({ id: 'protocolPool.detail.totalGrowth' }),
              accessorKey: 'withdrawDepositLabel',
              cell: ({ row }) => <Label align="center">{row.original.withdrawDepositLabel}</Label>,
              enableSorting: false,
              size: 120
            },
            {
              header: intl.formatMessage({ id: 'protocolPool.detail.percent' }),
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
        cell: ({ row }) => {
          const isRunePool = row.original.chain === 'THOR'
          const interactType = isRunePool ? InteractType.RunePool : InteractType.CacaoPool
          return (
            <div className="flex items-center justify-center">
              <ManageButton
                variant={isRunePool ? 'runePool' : 'cacaoPool'}
                interactType={interactType}
                useBorderButton={false}
                isTextView={isXLargeScreen}
                onManageClick={() => handleManageClick(row.original.chain, row.original.walletType, interactType)}
              />
            </div>
          )
        },
        enableSorting: false
      }
    ],
    [assetDetails, intl, isXLargeScreen, isXXLargeScreen, handleManageClick]
  )

  const dataSource = assetDetails.map(
    ({ asset, deposit, value, priceAsset, percent, walletType, privateData, chain }) => {
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
        walletType,
        chain
      }
    }
  )

  return <Table loading={false} columns={columns} data={dataSource} />
}
