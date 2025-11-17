import * as RD from '@devexperts/remote-data-ts'
import { BaseAmount, bn } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { either as E, function as FP, option as O } from 'fp-ts'
import { IntlShape } from 'react-intl'

import { optionFromNullableString } from '../../../../../shared/utils/fp'
import { greaterThan, greaterThanEqualTo, validateBN } from '../../../../helpers/form/validation'
import { emptyString } from '../../../../helpers/stringHelper'
import { InteractState, NodeInfos } from '../../../../services/thorchain/types'
import { InteractType } from './Interact.types'

export const getInteractiveDescription = ({ state, intl }: { state: InteractState; intl: IntlShape }): string => {
  const { step, stepsTotal, txRD } = state
  const stepLabels = [
    intl.formatMessage({ id: 'common.tx.sending' }),
    intl.formatMessage({ id: 'common.tx.checkResult' })
  ]

  const stepLabel = `${intl.formatMessage({ id: 'common.step' }, { total: stepsTotal, current: step })}: ${
    stepLabels[step - 1]
  }...`

  return FP.pipe(
    txRD,
    RD.fold(
      () => emptyString,
      () => stepLabel,
      () => emptyString,
      () => intl.formatMessage({ id: 'common.tx.success' })
    )
  )
}

export const validateUnboundAmountInput = ({
  input,
  errors
}: {
  input: BigNumber
  errors: {
    msg1: string
    msg2: string
  }
}): Promise<void> => {
  // validate input
  return FP.pipe(
    input,
    // valid number
    validateBN(errors.msg1),
    // input > 0
    E.chain(greaterThan(bn(0))(errors.msg2)),
    // return Promise - needed by antd form
    E.fold(
      (left) => Promise.reject(left),
      (_) => Promise.resolve()
    )
  )
}

export const validateCustomAmountInput = ({
  input,
  errors
}: {
  input: BigNumber
  errors: {
    msg1: string
    msg2: string
  }
}): Promise<void> => {
  // validate input
  return FP.pipe(
    input,
    // valid number
    validateBN(errors.msg1),
    // input >= 0
    E.chain(greaterThanEqualTo(bn(0))(errors.msg2)),
    // return Promise - needed by antd form
    E.fold(
      (left) => Promise.reject(left),
      (_) => Promise.resolve()
    )
  )
}

export const isInteractType = (u: unknown): u is InteractType =>
  u === InteractType.Bond ||
  u === InteractType.Unbond ||
  u === InteractType.Leave ||
  u === InteractType.Custom ||
  u === InteractType.THORName ||
  u === InteractType.MAYAName ||
  u === InteractType.RunePool ||
  u === InteractType.CacaoPool ||
  u === InteractType.Whitelist

export const getInteractTypeFromNullableString = (s?: string): O.Option<InteractType> =>
  FP.pipe(s, optionFromNullableString, O.chain(O.fromPredicate(isInteractType)))

export const findNodeIndex = (nodes: NodeInfos, inputaddress: string) => {
  return nodes.findIndex(({ address, status }) => address.toLowerCase() === inputaddress && status === 'Active')
}

export const getProtocolPoolWithdrawBps = (pooledAmount: BaseAmount, withdrawAmount: BaseAmount): number => {
  const value1 = pooledAmount.amount()
  const value2 = withdrawAmount.amount()

  if (value1.isZero()) {
    return 0
  }

  // Check if we're withdrawing the full amount (100%)
  if (value2.isGreaterThanOrEqualTo(value1)) {
    return 10000
  }

  const bps = value2.div(value1).multipliedBy(10000).decimalPlaces(0, 1).toNumber()

  return bps
}

export const getBlocksLeft = (
  lastBlock: number,
  lastDeposit: number,
  runePoolMimir: number
): { daysLeft: number; blocksLeft: number } => {
  const blocksSinceDeposit = lastBlock - lastDeposit
  const blocksLeft = Math.max(runePoolMimir - blocksSinceDeposit, 0)

  const secondsLeft = blocksLeft * 6
  const daysLeft = secondsLeft / (60 * 60 * 24)

  return {
    daysLeft,
    blocksLeft
  }
}
