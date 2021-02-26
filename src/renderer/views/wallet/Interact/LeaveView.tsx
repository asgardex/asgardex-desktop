import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { baseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { Leave } from '../../../components/interact/forms/Leave'
import { Button } from '../../../components/uielements/button'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { INITIAL_INTERACT_STATE } from '../../../services/thorchain/const'
import { AddressValidation, InteractState } from '../../../services/thorchain/types'
import * as Styled from './InteractView.styles'

type Props = {
  goToTransaction: (txHash: string) => void
}

export const LeaveView: React.FC<Props> = ({ goToTransaction }) => {
  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const { interact$, client$ } = useThorchainContext()
  const intl = useIntl()

  const oClient = useObservableState(client$, O.none)

  const addressValidation = useMemo(
    () =>
      FP.pipe(
        oClient,
        O.map((c) => c.validateAddress),
        O.getOrElse((): AddressValidation => (_: string) => true)
      ),
    [oClient]
  )

  const leaveTx = useCallback(
    ({ memo }: { memo: string }) => {
      subscribeInteractState(
        /**
         * Send minimal amount
         * @docs https://docs.thorchain.org/thornodes/leaving#leaving
         */

        interact$({ amount: baseAmount(1), memo })
      )
    },
    [interact$, subscribeInteractState]
  )

  const stepLabels = useMemo(
    () => [intl.formatMessage({ id: 'common.tx.sending' }), intl.formatMessage({ id: 'common.tx.checkResult' })],
    [intl]
  )
  const stepLabel = useMemo(
    () =>
      `${intl.formatMessage(
        { id: 'common.step' },
        { total: interactState.stepsTotal, current: interactState.step }
      )}: ${stepLabels[interactState.step - 1]}...`,
    [interactState, stepLabels, intl]
  )

  return FP.pipe(
    interactState.txRD,
    RD.fold(
      () => <Leave addressValidation={addressValidation} onFinish={leaveTx} />,
      () => (
        <Leave
          addressValidation={addressValidation}
          isLoading={true}
          onFinish={FP.identity}
          loadingProgress={stepLabel}
        />
      ),
      ({ msg }) => (
        <Styled.ErrorView title={intl.formatMessage({ id: 'deposit.leave.state.error' })} subTitle={msg}>
          <Button onClick={resetInteractState}>{intl.formatMessage({ id: 'common.back' })}</Button>
        </Styled.ErrorView>
      ),
      (txHash) => (
        <Styled.SuccessView title={intl.formatMessage({ id: 'common.success' })}>
          <Styled.ViewTxButton txHash={O.some(txHash)} onClick={goToTransaction} />
          <Button onClick={resetInteractState}>{intl.formatMessage({ id: 'common.back' })}</Button>
        </Styled.SuccessView>
      )
    )
  )
}