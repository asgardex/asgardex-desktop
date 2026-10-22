import { useMemo } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { useChurnConstants } from '../../../hooks/useChurnConstants'
import type { NextChurn } from '../../../hooks/useNextChurn'
import { NodeInfo, NodeStatusEnum } from '../../../services/thorchain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { InfoIcon } from '../../uielements/info'
import { formatBpsAsPercent, formatCountdown, formatRuneAmount } from './helpers'
import { cycleEstimate } from './nodeNetwork'

type Props = {
  network: Network
  node: NodeInfo
  nextChurn: O.Option<NextChurn>
  isPrivate: boolean
}

export const CycleSoFarCard = ({ network, node, nextChurn, isPrivate }: Props) => {
  const intl = useIntl()
  const constants = useChurnConstants()
  const isActive = node.status === NodeStatusEnum.Active

  const oRunning = FP.pipe(
    nextChurn,
    O.chain((churn) => (churn.halted ? O.none : O.some(churn)))
  )
  const halted = FP.pipe(
    nextChurn,
    O.exists(({ halted }) => halted)
  )
  const estimate = useMemo(() => cycleEstimate(node, O.toUndefined(oRunning), constants), [constants, oRunning, node])

  const amount = (value: BaseAmount) => (isPrivate ? hiddenString : formatRuneAmount(value))

  const renderShare = (label: string, value: BaseAmount) => (
    <div className="flex flex-col gap-1">
      <span className="font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
        {label}
      </span>
      <span className="flex items-center gap-1.5 font-main text-[15px] text-text0 dark:text-text0d">
        <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
        {amount(value)}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <div className="flex items-center justify-between gap-2">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.cycle.title' })}
        </span>
        <span className="flex items-center gap-1 font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.cycle.estimate' })}
          <InfoIcon tooltipSize="big" tooltip={intl.formatMessage({ id: 'bonds.cycle.estimateInfo' })} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <AssetIcon asset={AssetRuneNative} size="normal" network={network} />
        <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
          {amount(isActive ? estimate.award : ZERO_BASE_AMOUNT)}
        </span>
      </div>
      <span className="mt-2 font-main text-[13px] text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: isActive ? 'bonds.cycle.sub' : 'bonds.cycle.standby' })}
      </span>
      {isActive && (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-solid border-gray0 pt-4 dark:border-gray0d">
          {renderShare(
            intl.formatMessage(
              { id: 'bonds.cycle.operatorFee' },
              { fee: formatBpsAsPercent(estimate.feeBps, intl.locale) }
            ),
            estimate.operatorShare
          )}
          {renderShare(intl.formatMessage({ id: 'bonds.cycle.providers' }), estimate.providersShare)}
        </div>
      )}
      <div className="mt-auto pt-4">
        <div className="h-[6px] w-full overflow-hidden rounded-full bg-gray0 dark:bg-gray0d">
          <div className="h-full rounded-full bg-turquoise" style={{ width: `${estimate.progress * 100}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 font-main text-[12px] text-gray2 dark:text-gray2d">
          <span>
            {O.isSome(oRunning) &&
              intl.formatMessage(
                { id: 'bonds.cycle.elapsed' },
                { percent: intl.formatNumber(estimate.progress, { style: 'percent', maximumFractionDigits: 0 }) }
              )}
          </span>
          <span className="text-text0 dark:text-text0d">
            {halted
              ? intl.formatMessage({ id: 'bonds.churn.halted' })
              : FP.pipe(
                  oRunning,
                  O.fold(
                    () => intl.formatMessage({ id: 'bonds.cycle.churnUnknown' }),
                    ({ msLeft }) => intl.formatMessage({ id: 'bonds.cycle.churnIn' }, { time: formatCountdown(msLeft) })
                  )
                )}
          </span>
        </div>
      </div>
    </div>
  )
}
