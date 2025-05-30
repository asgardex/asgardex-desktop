import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ScaleIcon } from '@heroicons/react/24/outline'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { baseToAsset, Chain, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { IncentivePendulumRD } from '../../hooks/useIncentivePendulum'
import { Tooltip } from '../uielements/common/Common.styles'

export type Props = {
  incentivePendulum: IncentivePendulumRD
  protocol: Chain
}

export const IncentivePendulum = (props: Props): JSX.Element => {
  const { incentivePendulum: incentivePendulumRD, protocol } = props

  const intl = useIntl()

  const loading = (
    <div className="flex items-center justify-center w-full text-text2 dark:text-text2d px-2 pb-1 uppercase font-main text-xs">
      {intl.formatMessage({ id: 'pools.incentivependulum.info' }, { percentage: '...' })}
      <ScaleIcon className="ml-1" width={16} height={16} />
    </div>
  )

  const protocolAsset = useMemo(() => (protocol === THORChain ? AssetRuneNative : AssetCacao), [protocol])

  return FP.pipe(
    incentivePendulumRD,
    RD.fold(
      () => loading,
      () => loading,
      (_) => (
        <div className="uppercase text-center w-full text-text2 dark:text-text2d text-xs font-main px-2 pb-1">
          {intl.formatMessage({ id: 'pools.incentivependulum.error' })}
        </div>
      ),
      ({ incentivePendulum, incentivePendulumLight, totalPooledRuneAmount, totalActiveBondAmount }) => {
        // Transform `IncentivePendulumLight` -> `AlertIconColor`
        const getColor = () => {
          switch (incentivePendulumLight) {
            case 'green':
              return 'text-turquoise'
            case 'yellow':
              return 'text-warning0 dark:text-warning0d'
            case 'red':
              return 'text-error0 dark:text-error0d'
            default:
              return 'text-gray0 dark:text-gray0d'
          }
        }

        const tooltip = intl.formatMessage(
          { id: 'pools.incentivependulum.tooltip' },
          {
            pooled: formatAssetAmountCurrency({
              amount: baseToAsset(totalPooledRuneAmount),
              asset: protocolAsset,
              decimal: 0
            }),
            bonded: formatAssetAmountCurrency({
              amount: baseToAsset(totalActiveBondAmount),
              asset: protocolAsset,
              decimal: 0
            })
          }
        )

        return (
          <Tooltip title={tooltip}>
            <div className="flex items-center justify-center w-full text-text2 dark:text-text2d px-2 pb-1 uppercase font-main text-xs">
              {intl.formatMessage({ id: 'pools.incentivependulum.info' }, { percentage: incentivePendulum })}
              <ScaleIcon className={clsx('ml-1', getColor())} width={20} height={20} />
            </div>
          </Tooltip>
        )
      }
    )
  )
}
