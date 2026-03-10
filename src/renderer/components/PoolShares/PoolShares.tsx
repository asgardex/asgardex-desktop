import { useMemo } from 'react'

import { ArrowUpIcon } from '@heroicons/react/24/outline'
import { ColumnDef } from '@tanstack/react-table'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, baseAmount, baseToAsset, Chain, formatAssetAmountCurrency, formatBN } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import * as PoolHelpers from '../../helpers/poolHelper'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { MimirHalt } from '../../services/thorchain/types'
import { useApp } from '../../store/app/hooks'
import { FixmeType } from '../../types/asgardex'
import { Table } from '../table'
import { AssetData } from '../uielements/assets/assetData'
import { Button, ManageButton } from '../uielements/button'
import { Label } from '../uielements/label'
import { PoolShareTableRowData } from './PoolShares.types'

export type Props = {
  data: PoolShareTableRowData[]
  loading: boolean
  priceAsset: AnyAsset | undefined
  network: Network
  openShareInfo: FP.Lazy<void>
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}

export const PoolShares = ({ data, priceAsset, openShareInfo, loading, network, haltedChains, mimirHalt }: Props) => {
  const { protocol } = useApp()
  const intl = useIntl()

  const protocolAsset = useMemo(() => (protocol === THORChain ? AssetRuneNative : AssetCacao), [protocol])
  const protocolUrl = useMemo(() => (protocol === THORChain ? 'runescan.io' : 'explorer.mayachain.info'), [protocol])

  const isDesktopView = useBreakpoint()?.lg ?? false
  const isXLargeScreen = useBreakpoint()?.xl ?? false

  const columns: ColumnDef<PoolShareTableRowData, FixmeType>[] = useMemo(
    () => [
      {
        accessorKey: 'asset',
        header: intl.formatMessage({ id: 'common.pool' }),
        cell: ({ row }) => {
          const { asset, type } = row.original

          return (
            <div className="flex items-center justify-between">
              <AssetData asset={asset} network={network} />
              <Label className="hidden !w-auto rounded bg-turquoise px-1 lg:flex" color="white">
                {type}
              </Label>
            </div>
          )
        },
        enableSorting: false
      },
      ...(isXLargeScreen
        ? ([
            {
              accessorKey: 'ownership',
              header: () => <Label align="right">{intl.formatMessage({ id: 'poolshares.ownership' })}</Label>,
              cell: ({ row }) => {
                const { sharePercent } = row.original

                return <Label align="right">{formatBN(sharePercent, 2)}%</Label>
              },
              size: 100,
              enableSorting: false
            },
            {
              accessorKey: 'assetCol',
              header: () => <Label align="right">{intl.formatMessage({ id: 'common.asset' })}</Label>,
              cell: ({ row }) => {
                const { asset, assetShare } = row.original

                return (
                  <Label align="right">
                    {formatAssetAmountCurrency({
                      amount: baseToAsset(assetShare),
                      asset,
                      decimal: 2
                    })}
                  </Label>
                )
              },
              size: 100,
              enableSorting: false
            },
            {
              accessorKey: 'runeCol',
              header: () => <Label align="right">{protocolAsset.symbol}</Label>,
              cell: ({ row }) => {
                const { runeShare } = row.original

                return (
                  <Label align="right">
                    {formatAssetAmountCurrency({
                      amount: baseToAsset(runeShare),
                      asset: protocolAsset,
                      decimal: 2
                    })}
                  </Label>
                )
              },
              size: 100,
              enableSorting: false
            }
          ] as ColumnDef<PoolShareTableRowData, FixmeType>[])
        : []),
      {
        accessorKey: 'value',
        header: () => <Label align="right">{intl.formatMessage({ id: 'common.value' })}</Label>,
        cell: ({ row }) => {
          const { assetDepositPrice, runeDepositPrice } = row.original
          const totalPrice = baseAmount(runeDepositPrice.amount().plus(assetDepositPrice.amount()))

          return (
            <Label align={isDesktopView ? 'right' : 'center'}>
              {formatAssetAmountCurrency({ amount: baseToAsset(totalPrice), asset: priceAsset, decimal: 2 })}
            </Label>
          )
        },
        size: 100,
        enableSorting: false
      },
      {
        accessorKey: 'action',
        header: '',
        cell: ({ row }) => {
          const { asset, type } = row.original
          const disablePool = PoolHelpers.disableAllActions({ chain: asset.chain, haltedChains, mimirHalt })

          return (
            <div className="flex items-center justify-center">
              <ManageButton
                disabled={disablePool || type === 'asym'}
                asset={asset}
                variant="manage"
                useBorderButton={false}
                isTextView={isDesktopView}
                title={intl.formatMessage(
                  { id: 'poolshares.single.notsupported' },
                  { asset: asset.ticker, rune: protocolAsset.ticker }
                )}
              />
            </div>
          )
        },
        enableSorting: false
      }
    ],
    [haltedChains, intl, isDesktopView, isXLargeScreen, mimirHalt, network, priceAsset, protocolAsset]
  )

  const renderAnalyticsInfo = useMemo(() => {
    return network !== Network.Testnet ? (
      <div className="mt-2 mb-4 flex w-full justify-end">
        <div className="rounded-lg bg-turquoise/20 px-2 py-1">
          <Button className="w-full !justify-between !p-0" typevalue="transparent" onClick={openShareInfo}>
            <Label className="!w-auto" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'common.analytics' })}
            </Label>
            <ArrowUpIcon className="h-4 w-4 rotate-45 stroke-turquoise" />
          </Button>
          <Label color="input" size="normal" textTransform="uppercase">
            {protocolUrl}
          </Label>
        </div>
      </div>
    ) : (
      <></>
    )
  }, [network, openShareInfo, intl, protocolUrl])

  return (
    <div className="bg-bg0 px-2 dark:bg-bg0d">
      <Table loading={loading} columns={columns} data={data} />
      {renderAnalyticsInfo}
    </div>
  )
}
