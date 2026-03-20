import { useMemo } from 'react'

import { ArrowRightIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { AssetIcon } from '../../../uielements/assets/assetIcon'
import * as C from '../extra/Common.types'
import { TxConfig } from '../TxModal.types'

type Props = {
  txConfig: TxConfig
  network: Network
}

/** Compact pill: [icon] TICKER  amount */
const AssetPill = ({ data, network }: { data: C.AssetData; network: Network }) => (
  <div className="flex items-center gap-2">
    <AssetIcon asset={data.asset} size="small" network={network} />
    <div className="flex flex-col">
      <span className="font-main-semi-bold text-sm text-text0 dark:text-text0d">{data.asset.ticker}</span>
      <span className="font-main text-xs text-text2 tabular-nums dark:text-text2d">
        {formatAssetAmount({ amount: baseToAsset(data.amount), trimZeros: true })}
      </span>
    </div>
  </div>
)

const OptionalAssetPill = ({ oData, network }: { oData: O.Option<C.AssetData>; network: Network }) =>
  FP.pipe(
    oData,
    O.fold(
      () => <></>,
      (data) => <AssetPill data={data} network={network} />
    )
  )

/** Swap: [source pill] → [target pill] in a single row */
const SwapDisplay = ({ source, target, network }: { source: C.AssetData; target: C.AssetData; network: Network }) => (
  <div className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray0 px-4 py-3 dark:border-gray0d">
    <AssetPill data={source} network={network} />
    <ArrowRightIcon className="h-4 w-4 shrink-0 text-gray1 dark:text-gray1d" />
    <AssetPill data={target} network={network} />
  </div>
)

/** Single asset in a card */
const SingleDisplay = ({ data, network }: { data: C.AssetData; network: Network }) => (
  <div className="flex w-full items-center justify-center rounded-lg border border-gray0 px-4 py-3 dark:border-gray0d">
    <AssetPill data={data} network={network} />
  </div>
)

/** Two assets stacked with arrow */
const DualDisplay = ({
  source,
  target,
  network
}: {
  source: O.Option<C.AssetData>
  target: C.AssetData
  network: Network
}) => (
  <div className="flex w-full flex-col items-center gap-1 rounded-lg border border-gray0 px-4 py-3 dark:border-gray0d">
    <OptionalAssetPill oData={source} network={network} />
    {O.isSome(source) && <ArrowDownIcon className="h-4 w-4 text-gray1 dark:text-gray1d" />}
    <AssetPill data={target} network={network} />
  </div>
)

export const TxAssetDisplay = ({ txConfig, network }: Props): JSX.Element => {
  const content = useMemo(() => {
    switch (txConfig.type) {
      case 'swap':
        return <SwapDisplay source={txConfig.source} target={txConfig.target} network={network} />

      case 'send':
      case 'interact':
      case 'deposit':
        return <SingleDisplay data={txConfig.asset} network={network} />

      case 'symDeposit':
        return <DualDisplay source={txConfig.source} target={txConfig.target} network={network} />

      case 'withdraw':
        return <DualDisplay source={txConfig.source} target={txConfig.target} network={network} />

      case 'claim':
        return (
          <div className="flex w-full items-center justify-center rounded-lg border border-gray0 px-4 py-3 dark:border-gray0d">
            <OptionalAssetPill oData={txConfig.source} network={network} />
          </div>
        )
    }
  }, [txConfig, network])

  return <div className="flex w-full px-6">{content}</div>
}
