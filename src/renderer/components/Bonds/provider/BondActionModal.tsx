import { useMemo, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, assetAmount, assetToBase, baseToAsset, bn } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ONE_RUNE_BASE_AMOUNT } from '../../../../shared/mock/amount'
import { THORChain } from '../../../../shared/utils/chainIds'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { truncateAddress } from '../../../helpers/addressHelper'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { getBondMemo, getUnbondMemo } from '../../../helpers/memoHelper'
import { NextChurn } from '../../../hooks/useNextChurn'
import { FeeRD } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { InteractStateHandler } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondProviderPosition } from '../../../views/bonds/types'
import { BaseButton, FlatButton } from '../../uielements/button'
import { InputBigNumber } from '../../uielements/input'
import { Modal } from '../../uielements/modal'
import { formatDuration, formatRuneAmount } from './helpers'
import { MemoPreview } from './MemoPreview'
import { useBondTxFlow } from './useBondTxFlow'

export type BondActionType = 'bond' | 'unbond'

type Props = {
  type: BondActionType
  network: Network
  position: BondProviderPosition
  walletBalance: BaseAmount
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

  const {
    isLoading,
    oFee,
    footerLabel,
    feeError: feeErrorOf,
    startSigning,
    modals
  } = useBondTxFlow({
    network,
    signer,
    fee: feeRD,
    interact$,
    validatePassword$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    onClose,
    onFinish
  })

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

  const feeError = feeErrorOf(walletBalance)

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

  const subtitle = truncateAddress(position.nodeAddress, THORChain, network)

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
                        (churn) =>
                          churn.halted
                            ? intl.formatMessage({ id: 'bonds.churn.whenResumes' })
                            : intl.formatMessage(
                                { id: 'bonds.provider.modal.nextChurn' },
                                { time: formatDuration(churn.msLeft) }
                              )
                      )
                    )
                  : intl.formatMessage({ id: 'bonds.provider.modal.immediately' })}
              </span>
            </div>
          </div>

          <MemoPreview memo={memo} />

          <FlatButton
            className="mt-6 w-full"
            size="large"
            loading={isLoading}
            disabled={submitDisabled}
            onClick={() => startSigning({ memo, amount: isBond ? amountToSend : ZERO_BASE_AMOUNT })}>
            {intl.formatMessage({ id: isBond ? 'bonds.provider.modal.signSend' : 'bonds.provider.modal.signUnbond' })}
          </FlatButton>
          <span className="mt-3 text-center font-main text-[13px] text-gray2 dark:text-gray2d">{footerLabel}</span>
        </div>
      </Modal>
      {modals}
    </>
  )
}
