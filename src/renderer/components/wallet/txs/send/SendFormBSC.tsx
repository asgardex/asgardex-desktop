import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetBSC, BSCChain } from '@xchainjs/xchain-bsc'
import { FeeOption, Fees, TxParams } from '@xchainjs/xchain-client'
import { validateAddress } from '@xchainjs/xchain-evm'
import {
  bn,
  baseToAsset,
  BaseAmount,
  assetToBase,
  assetAmount,
  Address,
  formatAssetAmountCurrency,
  baseAmount
} from '@xchainjs/xchain-util'
import { Form } from 'antd'
import { RadioChangeEvent } from 'antd/lib/radio'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { Network } from '../../../../../shared/api/types'
import { chainToString } from '../../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT, ZERO_BN } from '../../../../const'
import { isBscAsset } from '../../../../helpers/assetHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getBscAmountFromBalances } from '../../../../helpers/walletHelper'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { FeesRD, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { SelectedWalletAsset, ValidatePasswordHandler } from '../../../../services/wallet/types'
import { WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import * as StyledR from '../../../shared/form/Radio.styles'
import { FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
import { InputBigNumber } from '../../../uielements/input'
import { AccountSelector } from '../../account'
import * as H from '../TxForm.helpers'
import * as Styled from '../TxForm.styles'
import { validateTxAmountInput } from '../TxForm.util'
import { DEFAULT_FEE_OPTION } from './Send.const'
import * as Shared from './Send.shared'

export type FormValues = {
  recipient: Address
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
  fees: FeesRD
  reloadFeesHandler: (params: TxParams) => void
  validatePassword$: ValidatePasswordHandler
  network: Network
}

export const SendFormBSC: React.FC<Props> = (props): JSX.Element => {
  const {
    asset: { walletType, walletIndex, hdMode, walletAddress },
    balances,
    balance,
    transfer$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    fees: feesRD,
    reloadFeesHandler,
    validatePassword$,
    network
  } = props

  const intl = useIntl()

  const { asset } = balance

  const [selectedFeeOption, setSelectedFeeOption] = useState<FeeOption>(DEFAULT_FEE_OPTION)

  const [amountToSend, setAmountToSend] = useState<O.Option<BaseAmount>>(O.none)
  const [sendAddress, setSendAddress] = useState<O.Option<Address>>(O.none)

  const {
    state: sendTxState,
    reset: resetSendTxState,
    subscribe: subscribeSendTxState
  } = useSubscriptionState<SendTxState>(INITIAL_SEND_STATE)

  const isLoading = useMemo(() => RD.isPending(sendTxState.status), [sendTxState.status])

  const [form] = Form.useForm<FormValues>()

  const prevFeesRef = useRef<O.Option<Fees>>(O.none)

  const oFees: O.Option<Fees> = useMemo(() => FP.pipe(feesRD, RD.toOption), [feesRD])

  const feesAvailable = useMemo(() => O.isSome(oFees), [oFees])

  // Store latest fees as `ref`
  // needed to display previous fee while reloading
  useEffect(() => {
    FP.pipe(
      oFees,
      O.map((fees) => (prevFeesRef.current = O.some(fees)))
    )
  }, [oFees])

  const selectedFee: O.Option<BaseAmount> = useMemo(
    () =>
      FP.pipe(
        oFees,
        O.map((fees) => fees[selectedFeeOption])
      ),
    [oFees, selectedFeeOption]
  )

  const oAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset (if bsc)
    if (isBscAsset(asset)) {
      return O.some(balance.amount)
    }
    // or check list of other assets to get bsc balance
    return FP.pipe(balances, getBscAmountFromBalances, O.map(assetToBase))
  }, [asset, balance.amount, balances])

  const isFeeError = useMemo(() => {
    return FP.pipe(
      sequenceTOption(selectedFee, oAssetAmount),
      O.fold(
        // Missing (or loading) fees does not mean we can't sent something. No error then.
        () => false,
        ([fee, assetAmount]) => assetAmount.lt(fee)
      )
    )
  }, [oAssetAmount, selectedFee])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const amount: BaseAmount = FP.pipe(
      oAssetAmount,
      // no bsc asset == zero amount
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const msg = intl.formatMessage(
      { id: 'wallet.errors.fee.notCovered' },
      {
        balance: formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset: AssetBSC,
          trimZeros: true
        })
      }
    )

    return (
      <Styled.Label size="big" color="error">
        {msg}
      </Styled.Label>
    )
  }, [oAssetAmount, intl, isFeeError])

  const feeOptionsLabel: Record<FeeOption, string> = useMemo(
    () => ({
      [FeeOption.Fast]: intl.formatMessage({ id: 'wallet.send.fast' }),
      [FeeOption.Fastest]: intl.formatMessage({ id: 'wallet.send.fastest' }),
      [FeeOption.Average]: intl.formatMessage({ id: 'wallet.send.average' })
    }),
    [intl]
  )

  const renderFeeOptions = useMemo(() => {
    const onChangeHandler = (e: RadioChangeEvent) => {
      // Change amount back to `none` (ZERO) whenever selected fee is changed
      // Just to avoid using a previous `max` value, which can be invalid now
      setAmountToSend(O.none)
      setSelectedFeeOption(e.target.value)
    }
    const disabled = !feesAvailable || isLoading

    return (
      <StyledR.Radio.Group onChange={onChangeHandler} value={selectedFeeOption} disabled={disabled}>
        <StyledR.Radio value="fastest" key="fastest">
          <StyledR.RadioLabel disabled={disabled}>{feeOptionsLabel['fastest']}</StyledR.RadioLabel>
        </StyledR.Radio>
        <StyledR.Radio value="fast" key="fast">
          <StyledR.RadioLabel disabled={disabled}>{feeOptionsLabel['fast']}</StyledR.RadioLabel>
        </StyledR.Radio>
        <StyledR.Radio value="average" key="average">
          <StyledR.RadioLabel disabled={disabled}>{feeOptionsLabel['average']}</StyledR.RadioLabel>
        </StyledR.Radio>
      </StyledR.Radio.Group>
    )
  }, [feeOptionsLabel, feesAvailable, isLoading, selectedFeeOption])

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      if (!validateAddress(value.toLowerCase())) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }
    },
    [intl]
  )

  // max amount for bsc
  const maxAmount: BaseAmount = useMemo(() => {
    const maxBscAmount: BigNumber = FP.pipe(
      sequenceTOption(selectedFee, oAssetAmount),
      O.fold(
        // Set maxAmount to zero if we dont know anything about bsc and fee amounts
        () => ZERO_BN,
        ([fee, assetAmount]) => {
          const max = assetAmount.amount().minus(fee.amount())
          return max.isGreaterThan(0) ? max : ZERO_BN
        }
      )
    )
    return isBscAsset(asset) ? baseAmount(maxBscAmount, balance.amount.decimal) : balance.amount
  }, [selectedFee, oAssetAmount, asset, balance.amount])

  useEffect(() => {
    FP.pipe(
      amountToSend,
      O.fold(
        // reset value to ZERO whenever amount is not set
        () =>
          form.setFieldsValue({
            amount: ZERO_BN
          }),
        // Whenever `amountToSend` has been updated, we put it back into input field
        (amount) =>
          form.setFieldsValue({
            amount: baseToAsset(amount).amount()
          })
      )
    )
  }, [amountToSend, form])

  const amountValidator = useCallback(
    async (_: unknown, value: BigNumber) => {
      // error messages
      const errors = {
        msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
        msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
        msg3: isBscAsset(asset)
          ? intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
          : intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
      }
      return validateTxAmountInput({ input: value, maxAmount: baseToAsset(maxAmount), errors })
    },
    [asset, intl, maxAmount]
  )

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          setAmountToSend(O.some(assetToBase(assetAmount(value, balance.amount.decimal))))
        })
        .catch(() => setAmountToSend(O.none))
    },
    [amountValidator, balance.amount.decimal]
  )

  const onChangeAddress = useCallback(
    async ({ target }: React.ChangeEvent<HTMLInputElement>) => {
      const address = target.value
      // we have to validate input before storing into the state
      addressValidator(undefined, address)
        .then(() => {
          setSendAddress(O.some(address))
        })
        .catch(() => setSendAddress(O.none))
    },
    [setSendAddress, addressValidator]
  )

  const reloadFees = useCallback(() => {
    FP.pipe(
      sequenceTOption(amountToSend, sendAddress),
      O.map(([amount, recipient]) => {
        reloadFeesHandler({ asset, amount, recipient, memo: form.getFieldValue('memo') })
        return true
      })
    )

    return false
  }, [amountToSend, sendAddress, reloadFeesHandler, asset, form])

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  // State for visibility of Modal to confirm tx
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const submitTx = useCallback(
    () =>
      FP.pipe(
        sequenceTOption(amountToSend, sendAddress),
        O.map(([amount, recipient]) => {
          setSendTxStartTime(Date.now())
          subscribeSendTxState(
            transfer$({
              walletType,
              walletIndex,
              hdMode,
              sender: walletAddress,
              recipient,
              asset,
              amount,
              feeOption: selectedFeeOption,
              memo: form.getFieldValue('memo')
            })
          )
          return true
        })
      ),
    [
      amountToSend,
      sendAddress,
      subscribeSendTxState,
      transfer$,
      walletType,
      walletIndex,
      hdMode,
      walletAddress,
      asset,
      selectedFeeOption,
      form
    ]
  )

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
      const bscChainString = chainToString(BSCChain)
      const txtNeedsConnected = intl.formatMessage(
        {
          id: 'ledger.needsconnected'
        },
        { chain: bscChainString }
      )

      // extended description for ERC20 tokens only
      const description1 = !isBscAsset(asset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: bscChainString }
          )}`
        : txtNeedsConnected

      const description2 = intl.formatMessage({ id: 'ledger.sign' })

      return (
        <LedgerConfirmationModal
          network={network}
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          visible={showConfirmationModal}
          chain={BSCChain}
          description1={description1}
          description2={description2}
          addresses={O.none}
        />
      )
    }
    return null
  }, [walletType, submitTx, validatePassword$, intl, asset, network, showConfirmationModal])

  const renderTxModal = useMemo(
    () =>
      FP.pipe(
        amountToSend,
        O.fold(
          () => <></>,
          (amount) =>
            Shared.renderTxModal({
              asset,
              amountToSend: amount,
              network,
              sendTxState,
              resetSendTxState,
              sendTxStartTime,
              openExplorerTxUrl,
              getExplorerTxUrl,
              intl
            })
        )
      ),
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
        feesRD,
        RD.map((fees) => [{ asset: asset, amount: fees[selectedFeeOption] }])
      ),
    [feesRD, asset, selectedFeeOption]
  )

  const addMaxAmountHandler = useCallback(() => setAmountToSend(O.some(maxAmount)), [maxAmount])

  const [recipientAddress, setRecipientAddress] = useState<Address>('')
  const handleOnKeyUp = useCallback(() => {
    setRecipientAddress(form.getFieldValue('recipient'))
  }, [form])

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
          initialValues={{
            // default value for BigNumberInput
            amount: bn(0),
            // Default value for RadioGroup of feeOptions
            fee: DEFAULT_FEE_OPTION
          }}
          onFinish={() => setShowConfirmationModal(true)}
          labelCol={{ span: 24 }}>
          <Styled.SubForm>
            <Styled.CustomLabel size="big">
              {intl.formatMessage({ id: 'common.address' })}
              {renderWalletType}
            </Styled.CustomLabel>
            <Form.Item rules={[{ required: true, validator: addressValidator }]} name="recipient">
              <Styled.Input
                color="primary"
                size="large"
                disabled={isLoading}
                onBlur={reloadFees}
                onChange={onChangeAddress}
                onKeyUp={handleOnKeyUp}
              />
            </Form.Item>
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.amount' })}</Styled.CustomLabel>
            <Styled.FormItem rules={[{ required: true, validator: amountValidator }]} name="amount">
              <InputBigNumber
                min={0}
                size="large"
                disabled={isLoading}
                decimal={balance.amount.decimal}
                onBlur={reloadFees}
                onChange={onChangeInput}
              />
            </Styled.FormItem>
            <MaxBalanceButton
              className="mb-10px"
              color="neutral"
              balance={{ amount: maxAmount, asset }}
              onClick={addMaxAmountHandler}
              disabled={isLoading}
            />
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFees} disabled={isLoading} />
            {renderFeeError}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
            <Form.Item name="memo">
              <Styled.Input size="large" disabled={isLoading} onBlur={reloadFees} />
            </Form.Item>
            <Form.Item name="fee">{renderFeeOptions}</Form.Item>
          </Styled.SubForm>
          <FlatButton
            className="mt-40px min-w-[200px]"
            loading={isLoading}
            disabled={!feesAvailable || isLoading}
            type="submit"
            size="large">
            {intl.formatMessage({ id: 'wallet.action.send' })}
          </FlatButton>
        </Styled.Form>
      </Styled.Container>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
