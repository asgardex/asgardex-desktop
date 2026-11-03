import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ScaleIcon } from '@heroicons/react/24/outline'

import { baseToAsset, Chain, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'
import { AssetRuneNative, THORChain, AssetCacao } from '../../../shared/utils/chainIds'

import { IncentivePendulumRD } from '../../hooks/useIncentivePendulum'
import { useLastSuccessRD } from '../../hooks/useLastSuccess'
import { Label } from '../uielements/label'
import { Tooltip } from '../uielements/tooltip'

export type Props = {
  incentivePendulum: IncentivePendulumRD
  protocol: Chain
}

// Same box for loading, error and success state (icon is 20px high) to avoid layout shifts
const WRAPPER_CLASS = 'flex min-h-5 w-full items-center justify-center pb-1'

export const IncentivePendulum = (props: Props): JSX.Element => {
  const { incentivePendulum: incentivePendulumPropRD, protocol } = props
  // Keep the last value while reloading, to avoid flicker and layout shifts.
  // Note: Use `key={protocol}` in parent to not keep values of another protocol
  const incentivePendulumRD = useLastSuccessRD(incentivePendulumPropRD)

  const intl = useIntl()

  const loading = (
    <div className={clsx(WRAPPER_CLASS, 'px-2')}>
      <Label color="gray" size="small" textTransform="uppercase">
        {intl.formatMessage({ id: 'pools.incentivependulum.info' }, { percentage: '...' })}
      </Label>
      <ScaleIcon className="ml-1 text-gray0 dark:text-gray0d" width={20} height={20} />
    </div>
  )

  const protocolAsset = useMemo(() => (protocol === THORChain ? AssetRuneNative : AssetCacao), [protocol])

  return FP.pipe(
    incentivePendulumRD,
    RD.fold(
      () => loading,
      () => loading,
      (_) => (
        <div
          className={clsx(WRAPPER_CLASS, 'px-2 text-center font-main text-xs text-text2 uppercase dark:text-text2d')}>
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
          <div className={WRAPPER_CLASS}>
            <Tooltip title={tooltip}>
              <div className="flex items-center justify-center">
                <Label color="gray" size="small" textTransform="uppercase">
                  {intl.formatMessage({ id: 'pools.incentivependulum.info' }, { percentage: incentivePendulum })}
                </Label>
                <ScaleIcon className={clsx('ml-1', getColor())} width={20} height={20} />
              </div>
            </Tooltip>
          </div>
        )
      }
    )
  )
}
