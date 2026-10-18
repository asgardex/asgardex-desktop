import * as RD from '@devexperts/remote-data-ts'
import { ArrowRightIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { hiddenString } from '../../../helpers/stringHelper'
import { nodesPaidAtChurn, operatorFeesWindow, useOperatorFees } from '../../../hooks/useOperatorFees'
import { OperatorRewards } from '../../../services/runebond'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton } from '../../uielements/button'
import { formatRuneAmount } from './helpers'

export const OPERATOR_FEES_CHURNS = 12

type Props = {
  network: Network
  isPrivate: boolean
  operatorAddresses: Address[]
  onViewHistory: () => void
}

export const OperatorFeesTile = ({ network, isPrivate, operatorAddresses, onViewHistory }: Props) => {
  const intl = useIntl()
  const feesRD = useOperatorFees(operatorAddresses)

  const renderValue = (value: string, subtitle: string) => (
    <>
      <div className="mt-2 flex items-center gap-2">
        <AssetIcon asset={AssetRuneNative} size="small" network={network} />
        <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">{value}</span>
      </div>
      <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">{subtitle}</span>
    </>
  )

  const renderSuccess = (fees: OperatorRewards) => {
    const feesWindow = operatorFeesWindow(fees)
    const last = feesWindow.lastChurn
    const subtitle =
      last !== null
        ? intl.formatMessage(
            { id: 'bonds.operatorFees.tile.lastChurn' },
            {
              amount: isPrivate ? hiddenString : formatRuneAmount(last.amount),
              nodes: nodesPaidAtChurn(fees, last.churnHeight)
            }
          )
        : intl.formatMessage({
            id: fees.totals.lastChurn === null ? 'bonds.operatorFees.tile.noneYet' : 'bonds.operatorFees.page.noPayouts'
          })
    return (
      <>
        {renderValue(isPrivate ? hiddenString : formatRuneAmount(feesWindow.total), subtitle)}
        <BaseButton
          className="group mt-3 !p-0 font-main-semi-bold text-[12px] tracking-[1px] text-turquoise uppercase"
          onClick={onViewHistory}>
          {intl.formatMessage({ id: 'bonds.operatorFees.tile.viewHistory' })}
          <ArrowRightIcon className="ml-1 h-[14px] w-[14px] text-inherit transition-transform group-hover:translate-x-[2px]" />
        </BaseButton>
      </>
    )
  }

  return (
    <div className="flex flex-col">
      <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.operatorFees.tile.title' }, { count: OPERATOR_FEES_CHURNS })}
      </span>
      {FP.pipe(
        feesRD,
        RD.fold(
          () => renderValue('—', ''),
          () => renderValue('—', ''),
          () => renderValue('—', intl.formatMessage({ id: 'bonds.operatorFees.unavailable' })),
          renderSuccess
        )
      )}
    </div>
  )
}
