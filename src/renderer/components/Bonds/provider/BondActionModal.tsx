import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, assetAmount, assetToBase, baseToAsset, bn, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ONE_RUNE_BASE_AMOUNT } from '../../../../shared/mock/amount'
import { AssetRuneNative } from '../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../shared/utils/guard'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { truncateAddress } from '../../../helpers/addressHelper'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { getBondMemo, getUnbondMemo } from '../../../helpers/memoHelper'
import { NextChurn } from '../../../hooks/useNextChurn'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { INITIAL_INTERACT_STATE } from '../../../services/thorchain/const'
import { InteractState, InteractStateHandler } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondProviderPosition } from '../../../views/bonds/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../modal/confirmation'
import { UnifiedTxModal, extractTxHash, getTxTimerValue, txHashRDToBoolean } from '../../modal/tx'
import { BaseButton, FlatButton } from '../../uielements/button'
import { InputBigNumber } from '../../uielements/input'
import { Modal } from '../../uielements/modal'
import { formatApy, formatDuration, formatRuneAmount } from './helpers'

export type BondActionType = 'bond' | 'unbond'

type Props = {
  type: BondActionType
  network: Network
  position: BondProviderPosition
  walletBalance: BaseAmount
  bondingApy: O.Option<number>
  nextChurn: O.Option<NextChurn>
  fee: FeeRD
  interact$: InteractStateHandler
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  onClose: () => void
  onFinish: () => void
}

export const BondActionModal = ({
  type,
  network,
  position,
  walletBalance,
  bondingApy,
  nextChurn,
  fee: feeRD,
  interact$,
  validatePassword$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  onClose,
  onFinish
}: Props) => {
  const intl = useIntl()

  const isBond = type === 'bond'
  const { signer } = position

  const [amountInput, setAmountInput] = useState<BigNumber>(bn(0))
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [sendTxStartTime, setSendTxStartTime] = useState(0)

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const maxAmount: BaseAmount = useMemo(() => {
    if (!isBond) return position.myBond
    return FP.pipe(
      oFee,
      O.fold(
        () => ZERO_BASE_AMOUNT,
        (fee) => {
          const max = walletBalance.minus(fee.plus(ONE_RUNE_BASE_AMOUNT))
          return max.gt(ZERO_BASE_AMOUNT) ? max : ZERO_BASE_AMOUNT
        }
      )
    )
  }, [isBond, oFee, position.myBond, walletBalance])

  const amountToSend: BaseAmount = useMemo(
    () => assetToBase(assetAmount(amountInput, THORCHAIN_DECIMAL)),
    [amountInput]
  )

  const feeReady = O.isSome(oFee)

  const feeError: string | null = useMemo(
    () =>
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
    [intl, oFee, walletBalance]
  )

  const amountError: string | null = useMemo(() => {
    if (!feeReady || amountInput.isZero()) return null
    if (amountToSend.gt(maxAmount)) {
      return intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
    }
    return null
  }, [amountInput, amountToSend, feeReady, intl, maxAmount])

  const memo = useMemo(
    () => (isBond ? getBondMemo(position.nodeAddress) : getUnbondMemo(position.nodeAddress, amountToSend)),
    [amountToSend, isBond, position.nodeAddress]
  )

  const bondAfter: BaseAmount = useMemo(
    () => (isBond ? position.myBond.plus(amountToSend) : position.myBond.minus(amountToSend)),
    [amountToSend, isBond, position.myBond]
  )

  const submitDisabled = isLoading || !feeReady || feeError !== null || amountInput.isZero() || amountError !== null

  const submitTx = useCallback(() => {
    setSendTxStartTime(Date.now())
    subscribeInteractState(
      interact$({
        walletType: signer.walletType,
        walletAccount: signer.walletAccount,
        walletIndex: signer.walletIndex,
        hdMode: signer.hdMode,
        amount: isBond ? amountToSend : ZERO_BASE_AMOUNT,
        memo,
        asset: AssetRuneNative
      })
    )
  }, [amountToSend, interact$, isBond, memo, signer, subscribeInteractState])

  const renderConfirmationModal = useMemo(() => {
    const onSuccessHandler = () => {
      setShowConfirmationModal(false)
      submitTx()
    }
    const onCloseHandler = () => {
      setShowConfirmationModal(false)
    }

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
          visible={showConfirmationModal}
          chain={THORChain}
          description2={intl.formatMessage({ id: 'ledger.sign' })}
          addresses={O.none}
        />
      )
    }
    return <></>
  }, [intl, network, showConfirmationModal, signer.walletType, submitTx, validatePassword$])

  const renderTxModal = useMemo(() => {
    const { txRD } = interactState

    if (RD.isInitial(txRD)) return <></>

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
        txConfig={{ type: 'interact', asset: { asset: AssetRuneNative, amount: amountToSend } }}
        txHash={extractTxHash(txRD)}
        getExplorerTxUrl={getExplorerTxUrl}
        openExplorerTxUrl={openExplorerTxUrl}
        network={network}
      />
    )
  }, [
    amountToSend,
    getExplorerTxUrl,
    interactState,
    intl,
    network,
    onFinish,
    openExplorerTxUrl,
    resetInteractState,
    sendTxStartTime
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

  const subtitle = useMemo(() => {
    const nodeLabel = truncateAddress(position.nodeAddress, THORChain, network)
    return FP.pipe(
      bondingApy,
      O.filter(() => isBond),
      O.fold(
        () => nodeLabel,
        (apy) => `${nodeLabel} · ${formatApy(apy)} APY`
      )
    )
  }, [bondingApy, isBond, network, position.nodeAddress])

  return (
    <>
      <Modal
        containerClassName="lg:pl-[240px]"
        backdropClassName="bg-bg0/40 dark:bg-bg0d/40"
        visible
        title={intl.formatMessage({ id: isBond ? 'bonds.provider.bondMore' : 'bonds.provider.unbond' })}
        onCancel={isLoading ? undefined : onClose}
        closable={!isLoading}
        footer={false}>
        <div className="flex flex-col px-2 pb-2">
          <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">{subtitle}</span>

          <span className="mt-6 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'common.amount' })}
          </span>
          <div className="relative mt-2">
            <InputBigNumber
              value={amountInput}
              onChange={setAmountInput}
              disabled={isLoading}
              size="large"
              decimal={THORCHAIN_DECIMAL}
            />
            <BaseButton
              className="absolute top-1/2 right-3 -translate-y-1/2 !p-0 font-main-semi-bold text-[12px] text-turquoise uppercase"
              disabled={isLoading || !feeReady}
              onClick={() => setAmountInput(baseToAsset(maxAmount).amount())}>
              {intl.formatMessage({ id: 'common.max' })}
            </BaseButton>
          </div>
          <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
            {isBond
              ? intl.formatMessage(
                  { id: 'bonds.provider.modal.availableInWallet' },
                  { amount: formatRuneAmount(walletBalance) }
                )
              : intl.formatMessage({ id: 'bonds.provider.modal.unbondMax' })}
          </span>
          {(feeError ?? amountError) && (
            <span className="mt-1 font-main text-[14px] text-error0 dark:text-error0d">{feeError ?? amountError}</span>
          )}

          <div className="mt-4 flex flex-col gap-2 rounded-lg bg-bg1 p-4 dark:bg-bg1d">
            <div className="flex items-center justify-between">
              <span className="font-main text-[14px] text-text0 dark:text-text0d">
                {intl.formatMessage({
                  id: isBond ? 'bonds.provider.modal.bondAfter' : 'bonds.provider.modal.bondLeft'
                })}
              </span>
              <span className="font-main-semi-bold text-[14px] text-text0 dark:text-text0d">
                {formatRuneAmount(bondAfter.gt(ZERO_BASE_AMOUNT) ? bondAfter : ZERO_BASE_AMOUNT)} RUNE
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-main text-[14px] text-text0 dark:text-text0d">
                {intl.formatMessage({
                  id: isBond ? 'bonds.provider.modal.startsPaying' : 'bonds.provider.modal.fundsReturn'
                })}
              </span>
              <span className="font-main-semi-bold text-[14px] text-text0 dark:text-text0d">
                {isBond
                  ? FP.pipe(
                      nextChurn,
                      O.fold(
                        () => '—',
                        ({ msLeft }) =>
                          intl.formatMessage({ id: 'bonds.provider.modal.nextChurn' }, { time: formatDuration(msLeft) })
                      )
                    )
                  : intl.formatMessage({ id: 'bonds.provider.modal.immediately' })}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col rounded-lg border border-solid border-gray1 dark:border-gray0d">
            <div className="flex items-center justify-between border-b border-solid border-gray1 px-4 py-2 dark:border-gray0d">
              <span className="font-main-semi-bold text-[11px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.provider.modal.memo' })}
              </span>
              <span className="font-main text-[12px] text-gray2 dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.provider.modal.thorchainTx' })}
              </span>
            </div>
            <span className="px-4 py-3 font-mono text-[13px] break-all text-text0 dark:text-text0d">{memo}</span>
          </div>

          <FlatButton
            className="mt-6 w-full"
            size="large"
            loading={isLoading}
            disabled={submitDisabled}
            onClick={() => setShowConfirmationModal(true)}>
            {intl.formatMessage({ id: isBond ? 'bonds.provider.modal.signSend' : 'bonds.provider.modal.signUnbond' })}
          </FlatButton>
          <span className="mt-3 text-center font-main text-[13px] text-gray2 dark:text-gray2d">{footerLabel}</span>
        </div>
      </Modal>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
