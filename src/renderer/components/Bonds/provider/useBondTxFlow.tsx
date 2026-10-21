import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import { isKeystoreWallet, isLedgerWallet } from '../../../../shared/utils/guard'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { FeeRD, SendTxStateHandler } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { RUNEBOND_LISTING_ADDRESS, RUNEBOND_LISTING_MIN_AMOUNT } from '../../../services/runebond'
import { InteractStateHandler } from '../../../services/thorchain/types'
import { TxHashRD, ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondWalletInfo } from '../../../views/bonds/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../modal/confirmation'
import { UnifiedTxModal, extractTxHash, getTxTimerValue, txHashRDToBoolean } from '../../modal/tx'
import { formatRuneAmount } from './helpers'

type TxFlowCommonParams = {
  network: Network
  signer: BondWalletInfo
  fee: FeeRD
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  onClose: () => void
  onFinish: () => void
}

export type BondTxFlowParams = TxFlowCommonParams & {
  interact$: InteractStateHandler
}

export type RunebondTxFlowParams = TxFlowCommonParams & {
  transfer$: SendTxStateHandler
}

export type BondTxRequest = { memo: string; amount: BaseAmount }

export type RunebondTxRequest = BondTxRequest

export type BondTxFlow<R extends BondTxRequest = BondTxRequest> = {
  isLoading: boolean
  oFee: O.Option<BaseAmount>
  feeLabel: string
  footerLabel: string
  feeError: (walletBalance: BaseAmount, amount?: BaseAmount) => string | null
  startSigning: (params: R) => void
  modals: JSX.Element
}

export type RunebondTxFlow = BondTxFlow<RunebondTxRequest>

type TxFlowParams<R extends BondTxRequest> = TxFlowCommonParams & {
  txType: 'interact' | 'send'
  requiredAmount: BaseAmount
  finishOnFailure: boolean
  submit: (request: R) => Rx.Observable<TxHashRD>
}

const useTxFlow = <R extends BondTxRequest>({
  network,
  signer,
  fee: feeRD,
  validatePassword$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  onClose,
  onFinish,
  txType,
  requiredAmount,
  finishOnFailure,
  submit
}: TxFlowParams<R>): BondTxFlow<R> => {
  const intl = useIntl()

  const [pending, setPending] = useState<R | null>(null)
  const [submittedAmount, setSubmittedAmount] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const [sendTxStartTime, setSendTxStartTime] = useState(0)

  const { state: txRD, reset: resetTxState, subscribe: subscribeTxState } = useSubscriptionState<TxHashRD>(RD.initial)

  const isLoading = useMemo(() => RD.isPending(txRD), [txRD])

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const feeError = useCallback(
    (walletBalance: BaseAmount, amount: BaseAmount = requiredAmount): string | null =>
      FP.pipe(
        oFee,
        O.map((fee) => fee.plus(amount)),
        O.filter((required) => walletBalance.lt(required)),
        O.fold(
          () => null,
          (required) =>
            amount.gt(0)
              ? intl.formatMessage(
                  { id: 'bonds.operator.modal.insufficientBalance' },
                  { required: formatRuneAmount(required), balance: formatRuneAmount(walletBalance) }
                )
              : intl.formatMessage(
                  { id: 'wallet.errors.fee.notCovered' },
                  {
                    balance: formatAssetAmountCurrency({
                      amount: baseToAsset(walletBalance),
                      asset: AssetRuneNative,
                      trimZeros: true
                    })
                  }
                )
        )
      ),
    [intl, oFee, requiredAmount]
  )

  const submitTx = useCallback(
    (request: R) => {
      setSendTxStartTime(Date.now())
      setSubmittedAmount(request.amount)
      subscribeTxState(submit(request))
    },
    [submit, subscribeTxState]
  )

  const startSigning = useCallback((params: R) => setPending(params), [])

  const confirmationModal = useMemo(() => {
    if (!pending) return null

    const onSuccessHandler = () => {
      setPending(null)
      submitTx(pending)
    }
    const onCloseHandler = () => setPending(null)

    if (isKeystoreWallet(signer.walletType)) {
      return (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          validatePassword$={validatePassword$}
        />
      )
    }

    if (isLedgerWallet(signer.walletType)) {
      return (
        <LedgerConfirmationModal
          network={network}
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          visible
          chain={THORChain}
          description2={intl.formatMessage({ id: 'ledger.sign' })}
          addresses={O.none}
        />
      )
    }
    return null
  }, [intl, network, pending, signer.walletType, submitTx, validatePassword$])

  const txModal = useMemo(() => {
    if (RD.isInitial(txRD)) return null

    const closeHandler = () => {
      resetTxState()
      if (RD.isSuccess(txRD) || (RD.isFailure(txRD) && finishOnFailure)) onFinish()
      else if (!RD.isFailure(txRD)) onClose()
    }

    return (
      <UnifiedTxModal
        title={intl.formatMessage({ id: 'common.tx.sending' })}
        onClose={closeHandler}
        onFinish={closeHandler}
        startTime={sendTxStartTime}
        txRD={txHashRDToBoolean(txRD)}
        timerValue={getTxTimerValue(txRD)}
        txConfig={{ type: txType, asset: { asset: AssetRuneNative, amount: submittedAmount } }}
        txHash={extractTxHash(txRD)}
        getExplorerTxUrl={getExplorerTxUrl}
        openExplorerTxUrl={openExplorerTxUrl}
        network={network}
      />
    )
  }, [
    finishOnFailure,
    getExplorerTxUrl,
    intl,
    network,
    onClose,
    onFinish,
    openExplorerTxUrl,
    resetTxState,
    sendTxStartTime,
    submittedAmount,
    txRD,
    txType
  ])

  const feeLabel = useMemo(
    () =>
      FP.pipe(
        feeRD,
        RD.fold(
          () => '—',
          () => '—',
          () => '—',
          (fee) =>
            formatAssetAmountCurrency({
              amount: baseToAsset(fee),
              asset: AssetRuneNative,
              decimal: 4,
              trimZeros: true
            })
        )
      ),
    [feeRD]
  )

  const footerLabel = isKeystoreWallet(signer.walletType)
    ? intl.formatMessage({ id: 'bonds.provider.modal.signedLocally' }, { fee: feeLabel })
    : `${intl.formatMessage({ id: 'common.fee' })}: ${feeLabel}`

  return {
    isLoading,
    oFee,
    feeLabel,
    footerLabel,
    feeError,
    startSigning,
    modals: (
      <>
        {confirmationModal}
        {txModal}
      </>
    )
  }
}

export const useBondTxFlow = ({ interact$, ...params }: BondTxFlowParams): BondTxFlow => {
  const { signer } = params
  const submit = useCallback(
    ({ memo, amount }: BondTxRequest): Rx.Observable<TxHashRD> =>
      interact$({
        walletType: signer.walletType,
        walletAccount: signer.walletAccount,
        walletIndex: signer.walletIndex,
        hdMode: signer.hdMode,
        amount,
        memo,
        asset: AssetRuneNative
      }).pipe(RxOp.map(({ txRD }) => txRD)),
    [interact$, signer]
  )
  return useTxFlow({ ...params, txType: 'interact', requiredAmount: ZERO_BASE_AMOUNT, finishOnFailure: true, submit })
}

export const useRunebondTxFlow = ({ transfer$, ...params }: RunebondTxFlowParams): RunebondTxFlow => {
  const { signer } = params
  const submit = useCallback(
    ({ memo, amount }: RunebondTxRequest): Rx.Observable<TxHashRD> =>
      transfer$({
        walletType: signer.walletType,
        walletAccount: signer.walletAccount,
        walletIndex: signer.walletIndex,
        hdMode: signer.hdMode,
        sender: signer.address,
        recipient: RUNEBOND_LISTING_ADDRESS,
        amount,
        memo,
        asset: AssetRuneNative
      }).pipe(RxOp.map(({ status }) => status)),
    [signer, transfer$]
  )
  return useTxFlow({
    ...params,
    txType: 'send',
    requiredAmount: RUNEBOND_LISTING_MIN_AMOUNT,
    finishOnFailure: false,
    submit
  })
}
