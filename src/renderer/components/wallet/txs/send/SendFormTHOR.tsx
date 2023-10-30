import React, { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { ThorchainQuery, ThornameDetails } from '@xchainjs/xchain-thorchain-query'
import { Address, baseAmount } from '@xchainjs/xchain-util'
import { formatAssetAmountCurrency, assetAmount, bn, assetToBase, BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import { Form } from 'antd'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import debounce from 'lodash/debounce'
import { useIntl } from 'react-intl'

import { Network } from '../../../../../shared/api/types'
import { AssetRuneNative } from '../../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isRuneNativeAsset, THORCHAIN_DECIMAL } from '../../../../helpers/assetHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { noDataString } from '../../../../helpers/stringHelper'
import { getRuneNativeAmountFromBalances } from '../../../../helpers/walletHelper'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { FeeRD, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { SelectedWalletAsset, ValidatePasswordHandler } from '../../../../services/wallet/types'
import { WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { CheckButton } from '../../../uielements/button/CheckButton'
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
  thorchainQuery: ThorchainQuery
  network: Network
}

export const SendFormTHOR: React.FC<Props> = (props): JSX.Element => {
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
    thorchainQuery,
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

  const oRuneNativeAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset (if RuneNative)
    if (isRuneNativeAsset(asset)) {
      return O.some(balance.amount)
    }
    // or check list of other assets to get RuneNative balance
    return FP.pipe(balances, getRuneNativeAmountFromBalances, O.map(assetToBase))
  }, [asset, balance.amount, balances])

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const isFeeError = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oFee, oRuneNativeAmount),
      O.fold(
        // Missing (or loading) fees does not mean we can't sent something. No error then.
        () => !O.isNone(oFee),
        ([fee, runeAmount]) => runeAmount.amount().isLessThan(fee.amount())
      )
    )
  }, [oRuneNativeAmount, oFee])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const amount = FP.pipe(
      oRuneNativeAmount,
      // no RuneNative asset == zero amount
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const msg = intl.formatMessage(
      { id: 'wallet.errors.fee.notCovered' },
      {
        balance: formatAssetAmountCurrency({ amount: baseToAsset(amount), asset: AssetRuneNative, trimZeros: true })
      }
    )

    return (
      <Styled.Label size="big" color="error">
        {msg}
      </Styled.Label>
    )
  }, [oRuneNativeAmount, intl, isFeeError])

  // state variable for thornames
  const [oThorname, setThorname] = useState<O.Option<ThornameDetails>>(O.none)
  const [recipientAddress, setRecipientAddress] = useState<Address>('')
  const [thornameSend, setThornameSend] = useState<boolean>(false)
  const [showDetails, setShowDetails] = useState<boolean>(false)

  const debouncedAddressValidator = debounce(
    async (_: unknown, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      if (!addressValidation(value.toLowerCase())) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }
    },
    500 // Adjust the debounce delay (in milliseconds) as needed
  )
  const handleAddressInput = useCallback(async () => {
    const recipient = form.getFieldValue('recipient')

    if (!recipient || recipient.length > 30) {
      setThornameSend(false)
      debouncedAddressValidator(undefined, recipient)
      setRecipientAddress(recipient)
      return
    }

    try {
      const thornameDetails = await thorchainQuery.getThornameDetails(recipient)
      if (thornameDetails) {
        setThorname(O.some(thornameDetails))
        setRecipientAddress(thornameDetails.owner)
        setShowDetails(true)
      }
    } catch (error) {
      setThorname(O.none)

      return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
    }
  }, [form, thorchainQuery, setShowDetails, intl, debouncedAddressValidator])

  // max amount for RuneNative
  const maxAmount: BaseAmount = useMemo(() => {
    const maxRuneAmount = FP.pipe(
      sequenceTOption(oFee, oRuneNativeAmount),
      O.fold(
        // Set maxAmount to zero if we dont know anything about RuneNative and fee amounts
        () => ZERO_BASE_AMOUNT,
        ([fee, runeAmount]) => {
          const max = runeAmount.minus(fee)
          const zero = baseAmount(0, max.decimal)
          return max.gt(zero) ? max : zero
        }
      )
    )
    return isRuneNativeAsset(asset) ? maxRuneAmount : balance.amount
  }, [oFee, oRuneNativeAmount, asset, balance.amount])

  const amountValidator = useCallback(
    async (_: unknown, value: BigNumber) => {
      // error messages
      const errors = {
        msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
        msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
        msg3: isRuneNativeAsset(asset)
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
    const recipient = O.isSome(oThorname) ? oThorname.value.owner : recipientAddress

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
  }, [
    subscribeSendTxState,
    transfer$,
    walletType,
    walletIndex,
    oThorname,
    recipientAddress,
    asset,
    amountToSend,
    form,
    hdMode
  ])

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
          chain={THORChain}
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
        RD.map((fee) => [{ asset: AssetRuneNative, amount: fee }])
      ),

    [feeRD]
  )

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          setAmountToSend(assetToBase(assetAmount(value, THORCHAIN_DECIMAL)))
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

  const useThornameAddress = useCallback(() => {
    setThornameSend((prevThornameSend) => !prevThornameSend)
    setThorname(O.none)
    form.setFieldsValue({ recipient: undefined })
  }, [form])

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
              <CheckButton checked={thornameSend} clickHandler={useThornameAddress} disabled={isLoading}>
                {intl.formatMessage({ id: 'common.thorname' })}
              </CheckButton>
            </div>

            <Form.Item rules={[{ required: true }]} name="recipient">
              <Styled.Input color="primary" size="large" disabled={isLoading} onChange={handleAddressInput} />
            </Form.Item>
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.amount' })}</Styled.CustomLabel>
            <Styled.FormItem rules={[{ required: true, validator: amountValidator }]} name="amount">
              <InputBigNumber
                min={0}
                size="large"
                disabled={isLoading}
                decimal={THORCHAIN_DECIMAL}
                onChange={onChangeInput}
              />
            </Styled.FormItem>
            <MaxBalanceButton
              className="mb-10px "
              color="neutral"
              balance={{ amount: maxAmount, asset: asset }}
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
              {/* recipient address */}
              <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                <div>{intl.formatMessage({ id: 'common.recipient' })}</div>
                <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                  {FP.pipe(
                    oThorname,
                    O.map((thorname) => (
                      <TooltipAddress title={thorname.owner} key="tooltip-target-addr">
                        {recipientAddress}
                      </TooltipAddress>
                    )),
                    O.getOrElse(() => <>{noDataString}</>)
                  )}
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
