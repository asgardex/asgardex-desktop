import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import { isKeystoreWallet, isLedgerWallet } from '../../../../shared/utils/guard'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { INITIAL_INTERACT_STATE } from '../../../services/thorchain/const'
import { InteractState, InteractStateHandler } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondWalletInfo } from '../../../views/bonds/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../modal/confirmation'
import { UnifiedTxModal, extractTxHash, getTxTimerValue, txHashRDToBoolean } from '../../modal/tx'

export type BondTxFlowParams = {
  network: Network
  signer: BondWalletInfo
  fee: FeeRD
  interact$: InteractStateHandler
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  onFinish: () => void
}

export type BondTxFlow = {
  isLoading: boolean
  oFee: O.Option<BaseAmount>
  feeLabel: string
  footerLabel: string
  feeError: (walletBalance: BaseAmount) => string | null
  startSigning: (params: { memo: string; amount: BaseAmount }) => void
  modals: JSX.Element
}

export const useBondTxFlow = ({
  network,
  signer,
  fee: feeRD,
  interact$,
  validatePassword$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  onFinish
}: BondTxFlowParams): BondTxFlow => {
  const intl = useIntl()

  const [pending, setPending] = useState<{ memo: string; amount: BaseAmount } | null>(null)
  const [submittedAmount, setSubmittedAmount] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const [sendTxStartTime, setSendTxStartTime] = useState(0)

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const feeError = useCallback(
    (walletBalance: BaseAmount): string | null =>
      FP.pipe(
        oFee,
        O.filter((fee) => walletBalance.lt(fee)),
        O.fold(
          () => null,
          () =>
            intl.formatMessage(
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
    [intl, oFee]
  )

  const submitTx = useCallback(
    ({ memo, amount }: { memo: string; amount: BaseAmount }) => {
      setSendTxStartTime(Date.now())
      setSubmittedAmount(amount)
      subscribeInteractState(
        interact$({
          walletType: signer.walletType,
          walletAccount: signer.walletAccount,
          walletIndex: signer.walletIndex,
          hdMode: signer.hdMode,
          amount,
          memo,
          asset: AssetRuneNative
        })
      )
    },
    [interact$, signer, subscribeInteractState]
  )

  const startSigning = useCallback((params: { memo: string; amount: BaseAmount }) => setPending(params), [])

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
    const { txRD } = interactState
    if (RD.isInitial(txRD)) return null

    const closeHandler = () => {
      resetInteractState()
      onFinish()
    }

    return (
      <UnifiedTxModal
        title={intl.formatMessage({ id: 'common.tx.sending' })}
        onClose={closeHandler}
        onFinish={closeHandler}
        startTime={sendTxStartTime}
        txRD={txHashRDToBoolean(txRD)}
        timerValue={getTxTimerValue(txRD)}
        txConfig={{ type: 'interact', asset: { asset: AssetRuneNative, amount: submittedAmount } }}
        txHash={extractTxHash(txRD)}
        getExplorerTxUrl={getExplorerTxUrl}
        openExplorerTxUrl={openExplorerTxUrl}
        network={network}
      />
    )
  }, [
    getExplorerTxUrl,
    interactState,
    intl,
    network,
    onFinish,
    openExplorerTxUrl,
    resetInteractState,
    sendTxStartTime,
    submittedAmount
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
