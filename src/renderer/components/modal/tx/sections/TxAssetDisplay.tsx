import { useMemo } from 'react'

import { ArrowDownIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { AssetData } from '../../../uielements/assets/assetData'
import * as C from '../extra/Common.types'
import { TxConfig } from '../TxModal.types'

type Props = {
  txConfig: TxConfig
  network: Network
}

const AssetRow = ({ data, network, size = 'big' }: { data: C.AssetData; network: Network; size?: 'small' | 'big' }) => (
  <div className="flex w-full items-center justify-between px-10">
    <AssetData asset={data.asset} network={network} size={size} className="flex w-full items-center justify-start" />
    <span className="font-main-semi-bold text-lg text-text0 tabular-nums dark:text-text0d">
      {formatAssetAmount({ amount: baseToAsset(data.amount), trimZeros: true })}
    </span>
  </div>
)

const OptionalAssetRow = ({ oData, network }: { oData: O.Option<C.AssetData>; network: Network }) =>
  FP.pipe(
    oData,
    O.fold(
      () => <></>,
      (data) => <AssetRow data={data} network={network} />
    )
  )

const SwapDisplay = ({ source, target, network }: { source: C.AssetData; target: C.AssetData; network: Network }) => (
  <div className="relative flex w-full flex-col items-center justify-center gap-1">
    <AssetRow data={source} network={network} size="small" />
    <div className="flex items-center justify-center">
      <ArrowDownIcon className="h-5 w-5 text-gray1 dark:text-gray1d" />
    </div>
    <AssetRow data={target} network={network} size="small" />
  </div>
)

const SingleAssetDisplay = ({ data, network }: { data: C.AssetData; network: Network }) => (
  <div className="relative flex items-center justify-center">
    <div className="flex flex-col px-5">
      <AssetData size="big" asset={data.asset} amount={data.amount} network={network} />
    </div>
  </div>
)

const WithdrawDisplay = ({
  source,
  target,
  network
}: {
  source: O.Option<C.AssetData>
  target: C.AssetData
  network: Network
}) => (
  <div className="relative flex flex-col items-center justify-center gap-5">
    <OptionalAssetRow oData={source} network={network} />
    {O.isSome(source) && (
      <div className="flex items-center justify-center">
        <ArrowDownIcon className="h-5 w-5 text-gray1 dark:text-gray1d" />
      </div>
    )}
    <AssetRow data={target} network={network} />
  </div>
)

export const TxAssetDisplay = ({ txConfig, network }: Props): JSX.Element => {
  const content = useMemo(() => {
    switch (txConfig.type) {
      case 'swap':
        return <SwapDisplay source={txConfig.source} target={txConfig.target} network={network} />

      case 'send':
      case 'interact':
        return <SingleAssetDisplay data={txConfig.asset} network={network} />

      case 'deposit':
        return <SingleAssetDisplay data={txConfig.asset} network={network} />

      case 'symDeposit':
        return (
          <div className="relative flex flex-col items-center justify-center gap-5">
            <OptionalAssetRow oData={txConfig.source} network={network} />
            <AssetRow data={txConfig.target} network={network} />
          </div>
        )

      case 'withdraw':
        return <WithdrawDisplay source={txConfig.source} target={txConfig.target} network={network} />

      case 'claim':
        return (
          <div className="relative flex items-center justify-center">
            <div className="flex flex-col px-5">
              <OptionalAssetRow oData={txConfig.source} network={network} />
            </div>
          </div>
        )
    }
  }, [txConfig, network])

  return <div className="flex w-full flex-col items-center justify-center">{content}</div>
}
