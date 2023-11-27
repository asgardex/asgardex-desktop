import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { CryptoAmount } from '@xchainjs/xchain-thorchain-query'
import { Address, baseAmount } from '@xchainjs/xchain-util'
import { formatAssetAmountCurrency, assetAmount, bn, assetToBase, BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import { Form } from 'antd'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { Network } from '../../../../../shared/api/types'
import { AssetCacao } from '../../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isCacaoAsset, CACAO_DECIMAL } from '../../../../helpers/assetHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getCacaoAmountFromBalances } from '../../../../helpers/walletHelper'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { FeeRD, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { SelectedWalletAsset, ValidatePasswordHandler } from '../../../../services/wallet/types'
import { WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { TooltipAddress } from '../../../uielements/common/Common.styles'
import { UIFeesRD } from '../../../uielements/fees'
import { InputBigNumber } from '../../../uielements/input'
import { AccountSelector } from '../../account'
import * as H from '../TxForm.helpers'
import * as Styled from '../TxForm.styles'
import { validateTxAmountInput } from '../TxForm.util'
import * as Shared from './Send.shared'

export type FormValues = {
  recipient: string
  amount: BigNumber
  memo?: string
}

export type Props = {
  asset: SelectedWalletAsset
  balances: WalletBalances
  balance: WalletBalance
  transfer$: SendTxStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  addressValidation: AddressValidation
  fee: FeeRD
  reloadFeesHandler: FP.Lazy<void>
  validatePassword$: ValidatePasswordHandler
  network: Network
}

export const SendFormMAYA: React.FC<Props> = (props): JSX.Element => {
  const {
    asset: { walletType, walletIndex, hdMode },

    balances,
    balance,
    transfer$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    addressValidation,
    fee: feeRD,
    reloadFeesHandler,
    validatePassword$,
    network
  } = props

  const intl = useIntl()

  const { asset } = balance
  const [amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const {
    state: sendTxState,
    reset: resetSendTxState,
    subscribe: subscribeSendTxState
  } = useSubscriptionState<SendTxState>(INITIAL_SEND_STATE)

  const isLoading = useMemo(() => RD.isPending(sendTxState.status), [sendTxState.status])

  const [form] = Form.useForm<FormValues>()
  const [showDetails, setShowDetails] = useState<boolean>(false)

  const oCacaoAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset (if Cacao)
    if (isCacaoAsset(asset)) {
      return O.some(balance.amount)
    }
    // or check list of other assets to get Cacao balance
    return FP.pipe(balances, getCacaoAmountFromBalances, O.map(assetToBase))
  }, [asset, balance.amount, balances])

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const isFeeError = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oFee, oCacaoAmount),
      O.fold(
        // Missing (or loading) fees does not mean we can't sent something. No error then.
        () => !O.isNone(oFee),
        ([fee, runeAmount]) => runeAmount.amount().isLessThan(fee.amount())
      )
    )
  }, [oCacaoAmount, oFee])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const amount = FP.pipe(
      oCacaoAmount,
      // no Cacao asset == zero amount
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const msg = intl.formatMessage(
      { id: 'wallet.errors.fee.notCovered' },
      {
        balance: formatAssetAmountCurrency({ amount: baseToAsset(amount), asset: AssetCacao, trimZeros: true })
      }
    )

    return (
      <Styled.Label size="big" color="error">
        {msg}
      </Styled.Label>
    )
  }, [oCacaoAmount, intl, isFeeError])

  const [recipientAddress, setRecipientAddress] = useState<Address>('')

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }

      if (!addressValidation(value)) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }
    },
    [addressValidation, intl]
  )
  const handleAddressInput = useCallback(async () => {
    const recipient = form.getFieldValue('recipient')

    if (recipient) {
      setRecipientAddress(recipient)
    }
  }, [form])

  // max amount for Cacao
  const maxAmount: BaseAmount = useMemo(() => {
    const maxRuneAmount = FP.pipe(
      sequenceTOption(oFee, oCacaoAmount),
      O.fold(
        // Set maxAmount to zero if we dont know anything about Cacao and fee amounts
        () => ZERO_BASE_AMOUNT,
        ([fee, runeAmount]) => {
          const max = runeAmount.minus(fee)
          const zero = baseAmount(0, max.decimal)
          return max.gt(zero) ? max : zero
        }
      )
    )
    return isCacaoAsset(asset) ? maxRuneAmount : balance.amount
  }, [oFee, oCacaoAmount, asset, balance.amount])

  // store maxAmountValue wrong CryptoAmount
  const [maxAmmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  // // useEffect to fetch data from query
  // useEffect(() => {
  //   const maxCryptoAmount = new CryptoAmount(maxAmount, asset)
  //   const fetchData = async () => {
  //     setMaxAmountPriceValue(await mayachainQuery.convert(maxCryptoAmount, AssetUSDC))
  //   }

  //   fetchData()
  // }, [asset, maxAmount])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    form.setFieldsValue({
      amount: baseToAsset(amountToSend).amount()
    })
  }, [amountToSend, form])

  const amountValidator = useCallback(
    async (_: unknown, value: BigNumber) => {
      // error messages
      const errors = {
        msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
        msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
        msg3: isCacaoAsset(asset)
          ? intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
          : intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
      }
      return validateTxAmountInput({ input: value, maxAmount: baseToAsset(maxAmount), errors })
    },
    [asset, intl, maxAmount]
  )

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const submitTx = useCallback(() => {
    setSendTxStartTime(Date.now())
    const recipient = recipientAddress

    subscribeSendTxState(
      transfer$({
        walletType,
        walletIndex,
        recipient,
        asset,
        amount: amountToSend,
        memo: form.getFieldValue('memo'),
        hdMode
      })
    )
  }, [subscribeSendTxState, transfer$, walletType, walletIndex, recipientAddress, asset, amountToSend, form, hdMode])

  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const renderConfirmationModal = useMemo(() => {
    const onSuccessHandler = () => {
      setShowConfirmationModal(false)
      submitTx()
    }
    const onCloseHandler = () => {
      setShowConfirmationModal(false)
    }

    if (isKeystoreWallet(walletType)) {
      return (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          validatePassword$={validatePassword$}
        />
      )
    }
    if (isLedgerWallet(walletType)) {
      return (
        <LedgerConfirmationModal
          network={network}
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          visible={showConfirmationModal}
          chain={MAYAChain}
          description2={intl.formatMessage({ id: 'ledger.sign' })}
          addresses={O.none}
        />
      )
    }
    return null
  }, [intl, network, submitTx, showConfirmationModal, validatePassword$, walletType])

  const renderTxModal = useMemo(
    () =>
      Shared.renderTxModal({
        asset,
        amountToSend,
        network,
        sendTxState,
        resetSendTxState,
        sendTxStartTime,
        openExplorerTxUrl,
        getExplorerTxUrl,
        intl
      }),
    [
      asset,
      amountToSend,
      network,
      sendTxState,
      resetSendTxState,
      sendTxStartTime,
      openExplorerTxUrl,
      getExplorerTxUrl,
      intl
    ]
  )

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        feeRD,
        RD.map((fee) => [{ asset: AssetCacao, amount: fee }])
      ),

    [feeRD]
  )

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          setAmountToSend(assetToBase(assetAmount(value, CACAO_DECIMAL)))
        })
        .catch(() => {}) // do nothing, Ant' form does the job for us to show an error message
    },
    [amountValidator]
  )

  const addMaxAmountHandler = useCallback(() => setAmountToSend(maxAmount), [maxAmount])

  const oMatchedWalletType: O.Option<WalletType> = useMemo(
    () => H.matchedWalletType(balances, recipientAddress),
    [balances, recipientAddress]
  )

  const renderWalletType = useMemo(() => H.renderedWalletType(oMatchedWalletType), [oMatchedWalletType])

  return (
    <>
      <Styled.Container>
        <AccountSelector selectedWallet={balance} network={network} />
        <Styled.Form
          form={form}
          initialValues={{ amount: bn(0) }}
          onFinish={() => setShowConfirmationModal(true)}
          labelCol={{ span: 24 }}>
          <Styled.SubForm>
            <div className="flex">
              <Styled.CustomLabel size="big">
                {intl.formatMessage({ id: 'common.address' })}
                {renderWalletType}
              </Styled.CustomLabel>
            </div>

            <Form.Item rules={[{ required: true, validator: addressValidator }]} name="recipient">
              <Styled.Input color="primary" size="large" disabled={isLoading} onChange={handleAddressInput} />
            </Form.Item>
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.amount' })}</Styled.CustomLabel>
            <Styled.FormItem rules={[{ required: true, validator: amountValidator }]} name="amount">
              <InputBigNumber
                min={0}
                size="large"
                disabled={isLoading}
                decimal={CACAO_DECIMAL}
                onChange={onChangeInput}
              />
            </Styled.FormItem>
            <MaxBalanceButton
              className="mb-10px "
              color="neutral"
              balance={{ amount: maxAmount, asset: asset }}
              maxDollarValue={maxAmmountPriceValue}
              onClick={addMaxAmountHandler}
              disabled={isLoading}
            />
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
            {renderFeeError}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
            <Form.Item name="memo">
              <Styled.Input size="large" disabled={isLoading} />
            </Form.Item>
          </Styled.SubForm>
          <FlatButton
            className="mt-40px min-w-[200px]"
            loading={isLoading}
            disabled={isFeeError}
            type="submit"
            size="large">
            {intl.formatMessage({ id: 'wallet.action.send' })}
          </FlatButton>
          <div className={`w-full pt-10 font-main text-[12px] uppercase dark:border-gray1d`}>
            <BaseButton
              className="goup flex w-full justify-between !p-0 font-mainSemiBold text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
              onClick={() => setShowDetails((current) => !current)}>
              {intl.formatMessage({ id: 'common.details' })}
              {showDetails ? (
                <MagnifyingGlassMinusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
              ) : (
                <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125 " />
              )}
            </BaseButton>
          </div>
          {showDetails && (
            <>
              {' '}
              {/* recipient address */}
              <div className="flex w-full items-center justify-between pl-10px text-[12px] dark:text-text2d">
                <div>{intl.formatMessage({ id: 'common.recipient' })}</div>
                <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                  <TooltipAddress key="tooltip-target-addr">{recipientAddress}</TooltipAddress>
                </div>
              </div>
            </>
          )}
        </Styled.Form>
      </Styled.Container>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
