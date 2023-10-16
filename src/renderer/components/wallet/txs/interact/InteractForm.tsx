import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetAmount, assetToBase, BaseAmount, baseToAsset, bn, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { Form, Tooltip } from 'antd'
import BigNumber from 'bignumber.js'
import * as E from 'fp-ts/Either'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { Network } from '../../../../../shared/api/types'
import { AssetRuneNative } from '../../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { THORCHAIN_DECIMAL } from '../../../../helpers/assetHelper'
import { validateAddress } from '../../../../helpers/form/validation'
import { getBondMemo, getLeaveMemo, getUnbondMemo } from '../../../../helpers/memoHelper'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../services/clients'
import { INITIAL_INTERACT_STATE } from '../../../../services/thorchain/const'
import { InteractState, InteractStateHandler } from '../../../../services/thorchain/types'
import { ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { TxModal } from '../../../modal/tx'
import { SendAsset } from '../../../modal/tx/extra/SendAsset'
import { BaseButton, FlatButton, ViewTxButton } from '../../../uielements/button'
import { CheckButton } from '../../../uielements/button/CheckButton'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
import { Input, InputBigNumber } from '../../../uielements/input'
import { Label } from '../../../uielements/label'
import { validateTxAmountInput } from '../TxForm.util'
import * as H from './Interact.helpers'
import * as Styled from './Interact.styles'
import { InteractType } from './Interact.types'

type FormValues = { memo: string; thorAddress: string; providerAddress: string; operatorFee: number; amount: BigNumber }

type Props = {
  interactType: InteractType
  walletType: WalletType
  walletIndex: number
  hdMode: HDMode
  balance: WalletBalance
  interact$: InteractStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  fee: FeeRD
  reloadFeesHandler: FP.Lazy<void>
  addressValidation: AddressValidation
  validatePassword$: ValidatePasswordHandler
  network: Network
}
export const InteractForm: React.FC<Props> = (props) => {
  const {
    interactType,
    balance,
    walletType,
    hdMode,
    walletIndex,
    interact$,
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

  const [hasProviderAddress, setHasProviderAddress] = useState(false)

  const [_amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const [memo, setMemo] = useState<string>()
  const amountToSend = useMemo(() => {
    switch (interactType) {
      case 'bond':
      case 'custom':
      case 'unbond':
        return _amountToSend
      case 'leave':
        return ZERO_BASE_AMOUNT
      case 'thorname':
        return ZERO_BASE_AMOUNT
    }
  }, [_amountToSend, interactType])

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const [form] = Form.useForm<FormValues>()

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const isFeeError = useMemo(
    () =>
      FP.pipe(
        oFee,
        O.fold(
          // Missing (or loading) fees does not mean we can't sent something. No error then.
          () => !O.isNone(oFee),
          (fee) => balance.amount.amount().isLessThan(fee.amount())
        )
      ),
    [balance, oFee]
  )

  const renderFeeError = useMemo(
    () => (
      <Label size="big" color="error">
        {intl.formatMessage(
          { id: 'wallet.errors.fee.notCovered' },
          {
            balance: formatAssetAmountCurrency({
              amount: baseToAsset(balance.amount),
              asset: AssetRuneNative,
              trimZeros: true
            })
          }
        )}
      </Label>
    ),
    [intl, balance.amount]
  )

  // max amount for RuneNative
  const maxAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oFee,
        O.fold(
          // Set maxAmount to zero if we dont know anything about fees
          () => ZERO_BASE_AMOUNT,
          (fee) => balance.amount.minus(fee)
        )
      ),
    [oFee, balance.amount]
  )

  const amountValidator = useCallback(
    async (_: unknown, value: BigNumber) => {
      switch (interactType) {
        case 'bond':
          // similar to any other form for sending any amount
          return validateTxAmountInput({
            input: value,
            maxAmount: baseToAsset(maxAmount),
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
              msg3: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
            }
          })
        case 'unbond':
          return H.validateUnboundAmountInput({
            input: value,
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' })
            }
          })
        case 'custom':
          return H.validateCustomAmountInput({
            input: value,
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterOrEqualThan' }, { amount: '0' })
            }
          })
        case 'leave':
          return Promise.resolve(true)
      }
    },
    [interactType, intl, maxAmount]
  )

  const addMaxAmountHandler = useCallback(
    (maxAmount: BaseAmount) => {
      setAmountToSend(maxAmount)
      console.log('Amount set to:', maxAmount) // Debugging log
    },
    [setAmountToSend]
  )

  const addressValidator = useCallback(
    async (_: unknown, value: string) =>
      FP.pipe(
        value,
        validateAddress(
          addressValidation,
          intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' }),
          intl.formatMessage({ id: 'wallet.errors.address.invalid' })
        ),
        E.fold(
          (e) => Promise.reject(e),
          () => Promise.resolve()
        )
      ),
    [addressValidation, intl]
  )

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const getMemo = useCallback(() => {
    const thorAddress = form.getFieldValue('thorAddress')
    const providerAddress = form.getFieldValue('providerAddress')
    const nodeOperatorFee = form.getFieldValue('operatorFee')
    const feeInBasisPoints = nodeOperatorFee ? nodeOperatorFee * 100 : undefined

    let memo = ''

    switch (interactType) {
      case 'bond': {
        memo = getBondMemo(thorAddress, providerAddress, feeInBasisPoints)
        break
      }
      case 'unbond': {
        memo = getUnbondMemo(thorAddress, amountToSend, providerAddress)
        break
      }
      case 'leave': {
        memo = getLeaveMemo(thorAddress)
        break
      }
      case 'custom': {
        memo = form.getFieldValue('memo')
        break
      }
      case 'thorname': {
        memo = getLeaveMemo(thorAddress)
        break
      }
    }
    setMemo(memo)
    return memo
  }, [amountToSend, form, interactType])

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          const newAmountToSend = assetToBase(assetAmount(value, THORCHAIN_DECIMAL))
          setAmountToSend(newAmountToSend)
        })
        .catch(() => {})
      // do nothing, Ant' form does the job for us to show an error message
    },
    [amountValidator]
  )
  useEffect(() => {
    // This code will run after the state has been updated
    getMemo()
  }, [amountToSend, getMemo])

  const submitTx = useCallback(() => {
    setSendTxStartTime(Date.now())

    subscribeInteractState(
      interact$({
        walletType,
        walletIndex,
        hdMode,
        amount: amountToSend,
        memo: getMemo()
      })
    )
  }, [subscribeInteractState, interact$, walletType, walletIndex, hdMode, amountToSend, getMemo])

  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const reset = useCallback(() => {
    resetInteractState()
    form.resetFields()
    setHasProviderAddress(false)
    setMemo('')
    setAmountToSend(ZERO_BASE_AMOUNT)
  }, [form, resetInteractState])

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
    return <></>
  }, [walletType, submitTx, validatePassword$, network, showConfirmationModal, intl])

  const renderTxModal = useMemo(() => {
    const { txRD } = interactState

    // don't render TxModal in initial state
    if (RD.isInitial(txRD)) return <></>

    const oTxHash = RD.toOption(txRD)

    const txRDasBoolean = FP.pipe(
      txRD,
      RD.map((txHash) => !!txHash)
    )

    return (
      <TxModal
        title={intl.formatMessage({ id: 'common.tx.sending' })}
        onClose={reset}
        onFinish={reset}
        startTime={sendTxStartTime}
        txRD={txRDasBoolean}
        extraResult={
          <ViewTxButton
            txHash={oTxHash}
            onClick={openExplorerTxUrl}
            txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
          />
        }
        timerValue={FP.pipe(
          txRD,
          RD.fold(
            () => 0,
            FP.flow(
              O.map(({ loaded }) => loaded),
              O.getOrElse(() => 0)
            ),
            () => 0,
            () => 100
          )
        )}
        extra={
          <SendAsset
            asset={{ asset, amount: amountToSend }}
            network={network}
            description={H.getInteractiveDescription({ state: interactState, intl })}
          />
        }
      />
    )
  }, [interactState, intl, reset, sendTxStartTime, openExplorerTxUrl, getExplorerTxUrl, asset, amountToSend, network])

  const memoLabel = useMemo(
    () => (
      <Tooltip title={memo} key="tooltip-memo">
        {memo}
      </Tooltip>
    ),
    [memo]
  )

  const submitLabel = useMemo(() => {
    switch (interactType) {
      case 'bond':
        if (hasProviderAddress) {
          return intl.formatMessage({ id: 'deposit.interact.actions.addBondProvider' })
        } else {
          return intl.formatMessage({ id: 'deposit.interact.actions.bond' })
        }
      case 'unbond':
        return intl.formatMessage({ id: 'deposit.interact.actions.unbond' })
      case 'leave':
        return intl.formatMessage({ id: 'deposit.interact.actions.leave' })
      case 'custom':
        return intl.formatMessage({ id: 'wallet.action.send' })
      case 'thorname':
        return intl.formatMessage({ id: 'deposit.interact.actions.buyThorname' })
    }
  }, [interactType, intl, hasProviderAddress])

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        feeRD,
        RD.map((fee) => [{ asset: AssetRuneNative, amount: fee }])
      ),

    [feeRD]
  )

  const onClickHasProviderAddress = useCallback(() => {
    // clean address
    form.setFieldsValue({ providerAddress: undefined })
    form.setFieldsValue({ operatorFee: undefined })
    // toggle
    setHasProviderAddress((v) => !v)
    getMemo()
  }, [form, getMemo])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    form.setFieldsValue({
      amount: baseToAsset(_amountToSend).amount()
    })
  }, [_amountToSend, form])

  // Reset values whenever interactType has been changed (an user clicks on navigation tab)
  useEffect(() => {
    reset()
    setMemo('')
  }, [interactType, reset])

  const [showDetails, setShowDetails] = useState<boolean>(false)

  return (
    <Styled.Form
      form={form}
      onFinish={() => setShowConfirmationModal(true)}
      initialValues={{ thorAddress: '', amount: bn(0) }}>
      <>
        {/* Memo input (CUSTOM only) */}
        {interactType === 'custom' && (
          <Styled.InputContainer>
            <Styled.InputLabel>{intl.formatMessage({ id: 'common.memo' })}</Styled.InputLabel>
            <Form.Item
              name="memo"
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
                }
              ]}>
              <Input disabled={isLoading} onChange={() => getMemo()} size="large" />
            </Form.Item>
          </Styled.InputContainer>
        )}

        {/* Node address input (BOND/UNBOND/LEAVE only) */}
        {(interactType === 'bond' || interactType === 'unbond' || interactType === 'leave') && (
          <Styled.InputContainer>
            <Styled.InputLabel>{intl.formatMessage({ id: 'common.nodeAddress' })}</Styled.InputLabel>
            <Form.Item
              name="thorAddress"
              rules={[
                {
                  required: true,
                  validator: addressValidator
                }
              ]}>
              <Input disabled={isLoading} onChange={() => getMemo()} size="large" />
            </Form.Item>
          </Styled.InputContainer>
        )}

        {/* Provider address input (BOND/UNBOND/ only) */}
        {(interactType === 'bond' || interactType === 'unbond') && (
          <Styled.InputContainer style={{ paddingBottom: '20px' }}>
            <CheckButton checked={hasProviderAddress} clickHandler={onClickHasProviderAddress} disabled={isLoading}>
              {intl.formatMessage({ id: 'deposit.interact.label.bondprovider' })}
            </CheckButton>
            {hasProviderAddress && (
              <>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.providerAddress' })}</Styled.InputLabel>
                <Form.Item
                  name="providerAddress"
                  rules={[
                    {
                      required: hasProviderAddress,
                      validator: addressValidator
                    }
                  ]}>
                  <Input disabled={isLoading} onChange={() => getMemo()} size="large" />
                </Form.Item>
              </>
            )}
          </Styled.InputContainer>
        )}

        {/* Amount input (BOND/UNBOND/CUSTOM only) */}
        {!hasProviderAddress && (
          <>
            {(interactType === 'bond' || interactType === 'unbond' || interactType === 'custom') && (
              <Styled.InputContainer>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.amount' })}</Styled.InputLabel>
                <Styled.FormItem
                  name="amount"
                  rules={[
                    {
                      required: true,
                      validator: amountValidator
                    }
                  ]}>
                  <InputBigNumber
                    disabled={isLoading}
                    size="large"
                    decimal={THORCHAIN_DECIMAL}
                    onChange={onChangeInput}
                  />
                </Styled.FormItem>
                {/* max. amount button (BOND/CUSTOM only) */}
                {(interactType === 'bond' || interactType === 'custom') && (
                  <MaxBalanceButton
                    className="mb-10px"
                    color="neutral"
                    balance={{ amount: maxAmount, asset: asset }}
                    onClick={() => addMaxAmountHandler(maxAmount)}
                    disabled={isLoading}
                    onChange={() => getMemo()}
                  />
                )}
                <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
                {isFeeError && renderFeeError}
              </Styled.InputContainer>
            )}
          </>
        )}
        {hasProviderAddress && (
          <>
            {interactType === 'unbond' && (
              <Styled.InputContainer>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.amount' })}</Styled.InputLabel>
                <Styled.FormItem
                  name="amount"
                  rules={[
                    {
                      required: true,
                      validator: amountValidator
                    }
                  ]}>
                  <InputBigNumber
                    disabled={isLoading}
                    size="large"
                    decimal={THORCHAIN_DECIMAL}
                    onChange={onChangeInput}
                  />
                </Styled.FormItem>
                <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
                {isFeeError && renderFeeError}
              </Styled.InputContainer>
            )}
          </>
        )}

        {/* Fee input (BOND/UNBOND/CUSTOM only) */}
        {hasProviderAddress && (
          <>
            {interactType === 'bond' && (
              <Styled.InputContainer>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.fee.nodeOperator' })}</Styled.InputLabel>
                <Styled.FormItem
                  name="operatorFee"
                  rules={[
                    {
                      required: true
                    }
                  ]}>
                  <Input disabled={isLoading} size="large" onChange={() => getMemo()} />
                </Styled.FormItem>
              </Styled.InputContainer>
            )}
          </>
        )}
      </>

      <div>
        <FlatButton
          className="mt-10px min-w-[200px]"
          loading={isLoading}
          disabled={isLoading || !!form.getFieldsError().filter(({ errors }) => errors.length).length}
          type="submit"
          size="large">
          {submitLabel}
        </FlatButton>
      </div>
      <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
        {/* memo */}
        <div className={`my-20px w-full font-main text-[12px] uppercase dark:border-gray1d`}>
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
          {showDetails && (
            <>
              <div className="ml-[-2px] flex w-full items-start pt-10px font-mainBold text-[14px]">
                {intl.formatMessage({ id: 'common.memo' })}
              </div>
              <div className="truncate pl-10px font-main text-[12px]">{memoLabel}</div>
            </>
          )}
        </div>
      </div>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </Styled.Form>
  )
}
