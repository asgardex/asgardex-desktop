import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { FeeOption, FeesWithRates } from '@xchainjs/xchain-client'
import { DOGEChain, DOGE_DECIMAL } from '@xchainjs/xchain-doge'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import {
  Address,
  assetAmount,
  assetToBase,
  BaseAmount,
  baseAmount,
  baseToAsset,
  bn,
  CryptoAmount,
  eqAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { Form } from 'antd'
import { RadioChangeEvent } from 'antd/lib/radio'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { Network } from '../../../../../shared/api/types'
import { AssetDOGE } from '../../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isUSDAsset } from '../../../../helpers/assetHelper'
import { getPoolPriceValue } from '../../../../helpers/poolHelper'
import { loadingString } from '../../../../helpers/stringHelper'
import { usePricePool } from '../../../../hooks/usePricePool'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { FeesWithRatesRD } from '../../../../services/bitcoin/types'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { FeeRD, Memo, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { SelectedWalletAsset, ValidatePasswordHandler } from '../../../../services/wallet/types'
import { WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import * as StyledR from '../../../shared/form/Radio.styles'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
import { InfoIcon } from '../../../uielements/info'
import { InputBigNumber } from '../../../uielements/input'
import { ShowDetails } from '../../../uielements/showDetails'
import { Slider } from '../../../uielements/slider'
import { AccountSelector } from '../../account'
import * as H from '../TxForm.helpers'
import { checkMemo, memoCorrection } from '../TxForm.helpers'
import * as Styled from '../TxForm.styles'
import { validateTxAmountInput } from '../TxForm.util'
import { DEFAULT_FEE_OPTION } from './Send.const'
import * as Shared from './Send.shared'

export type FormValues = {
  recipient: string
  amount: BigNumber
  memo?: string
  feeRate?: number
}

export type Props = {
  asset: SelectedWalletAsset
  balances: WalletBalances
  balance: WalletBalance
  transfer$: SendTxStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  addressValidation: AddressValidation
  feesWithRates: FeesWithRatesRD
  reloadFeesHandler: (memo?: Memo) => void
  validatePassword$: ValidatePasswordHandler
  thorchainQuery: ThorchainQuery
  network: Network
  poolDetails: PoolDetails
}

export const SendFormDOGE: React.FC<Props> = (props): JSX.Element => {
  const {
    asset: { walletType, walletIndex, hdMode, walletAddress },
    poolDetails,
    balances,
    balance,
    transfer$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    addressValidation,
    feesWithRates: feesWithRatesRD,
    reloadFeesHandler,
    validatePassword$,
    thorchainQuery,
    network
  } = props

  const intl = useIntl()

  const { asset } = balance
  const pricePool = usePricePool()

  const [amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)

  const {
    state: sendTxState,
    reset: resetSendTxState,
    subscribe: subscribeSendTxState
  } = useSubscriptionState<SendTxState>(INITIAL_SEND_STATE)

  const isLoading = useMemo(() => RD.isPending(sendTxState.status), [sendTxState.status])

  const [selectedFeeOption, setSelectedFeeOption] = useState<FeeOption>(DEFAULT_FEE_OPTION)

  const [InboundAddress, setInboundAddress] = useState<string>('')

  const [assetFee, setAssetFee] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [feePriceValue, setFeePriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [amountPriceValue, setAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [warningMessage, setWarningMessage] = useState<string>('')

  const [swapMemoDetected, setSwapMemoDetected] = useState<boolean>(false)

  const [currentMemo, setCurrentMemo] = useState('')
  const [affiliateTracking, setAffiliateTracking] = useState<string>('')

  const [form] = Form.useForm<FormValues>()

  const handleMemo = useCallback(() => {
    let memoValue = form.getFieldValue('memo') as string

    // Check if a swap memo is detected
    if (checkMemo(memoValue)) {
      memoValue = memoCorrection(memoValue)
      setSwapMemoDetected(true)

      // Set affiliate tracking message
      setAffiliateTracking(`Swap memo detected 5bps affiliate fee applied`)
    } else {
      setSwapMemoDetected(false)
    }

    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [form])

  const prevFeesWithRatesRef = useRef<O.Option<FeesWithRates>>(O.none)

  const feeRD: FeeRD = useMemo(
    () =>
      FP.pipe(
        feesWithRatesRD,
        RD.map(({ fees }) => fees[selectedFeeOption])
      ),
    [feesWithRatesRD, selectedFeeOption]
  )

  const oFeesWithRates: O.Option<FeesWithRates> = useMemo(
    () => FP.pipe(feesWithRatesRD, RD.toOption),
    [feesWithRatesRD]
  )

  const feesAvailable = useMemo(() => O.isSome(oFeesWithRates), [oFeesWithRates])

  // useEffect to fetch data from query
  useEffect(() => {
    const fetchData = async () => {
      const inboundDetails = await thorchainQuery.thorchainCache.getInboundDetails()
      setInboundAddress(inboundDetails[DOGEChain].address)
    }

    fetchData()
  }, [thorchainQuery])
  // Store latest fees as `ref`
  // needed to display previous fee while reloading
  useEffect(() => {
    FP.pipe(
      oFeesWithRates,
      O.map((feesWithRates) => (prevFeesWithRatesRef.current = O.some(feesWithRates)))
    )
  }, [oFeesWithRates])

  const prevSelectedFeeRef = useRef<O.Option<BaseAmount>>(O.none)

  const selectedFee: O.Option<BaseAmount> = useMemo(
    () =>
      FP.pipe(
        oFeesWithRates,
        O.map(({ fees }) => {
          const fee = fees[selectedFeeOption]
          prevSelectedFeeRef.current = O.some(fee)
          return fee
        })
      ),
    [oFeesWithRates, selectedFeeOption]
  )

  const oFeeBaseAmount: O.Option<BaseAmount> = useMemo(
    () =>
      FP.pipe(
        oFeesWithRates,
        O.map(({ fees }) => {
          const fee = fees[selectedFeeOption]
          prevSelectedFeeRef.current = O.some(fee)
          setAssetFee(new CryptoAmount(fees[selectedFeeOption], asset))
          return fee
        })
      ),
    [asset, oFeesWithRates, selectedFeeOption]
  )

  const isFeeError = useMemo(() => {
    return FP.pipe(
      oFeeBaseAmount,
      O.fold(
        // Missing (or loading) fees does not mean we can't sent something. No error then.
        () => false,
        (fee) => balance.amount.amount().isLessThan(fee.amount())
      )
    )
  }, [balance.amount, oFeeBaseAmount])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const msg = intl.formatMessage(
      { id: 'wallet.errors.fee.notCovered' },
      {
        balance: formatAssetAmountCurrency({
          amount: baseToAsset(balance.amount),
          asset: AssetDOGE,
          trimZeros: true
        })
      }
    )

    return (
      <Styled.Label size="big" color="error">
        {msg}
      </Styled.Label>
    )
  }, [balance.amount, intl, isFeeError])

  const feeOptionsLabel: Record<FeeOption, string> = useMemo(
    () => ({
      [FeeOption.Fast]: intl.formatMessage({ id: 'wallet.send.fast' }),
      [FeeOption.Fastest]: intl.formatMessage({ id: 'wallet.send.fastest' }),
      [FeeOption.Average]: intl.formatMessage({ id: 'wallet.send.average' })
    }),
    [intl]
  )

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      if (!addressValidation(value)) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }
      if (InboundAddress === value) {
        const type = 'Inbound'
        setWarningMessage(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type: type }))
      }
    },
    [InboundAddress, addressValidation, intl]
  )

  const maxAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        selectedFee,
        O.alt(() => prevSelectedFeeRef.current),
        O.map((fee) => {
          const max = balance.amount.minus(fee)
          const zero = baseAmount(0, max.decimal)
          return max.gt(zero) ? max : zero
        }),
        // Set maxAmount to zero as long as we dont have a feeRate
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      ),
    [balance.amount, selectedFee]
  )

  // store maxAmountValue
  const [maxAmmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  // useEffect to fetch data from query
  useEffect(() => {
    const maxAmountPrice = getPoolPriceValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool,
      network
    })
    const amountPrice = getPoolPriceValue({
      balance: { asset, amount: amountToSend },
      poolDetails,
      pricePool,
      network
    })
    const assetFeePrice = getPoolPriceValue({
      balance: { asset, amount: assetFee.baseAmount },
      poolDetails,
      pricePool,
      network
    })
    if (O.isSome(assetFeePrice)) {
      const maxCryptoAmount = new CryptoAmount(assetFeePrice.value, pricePool.asset)
      setFeePriceValue(maxCryptoAmount)
    }
    if (O.isSome(amountPrice)) {
      const amountPriceAmount = new CryptoAmount(amountPrice.value, pricePool.asset)
      setAmountPriceValue(amountPriceAmount)
    }
    if (O.isSome(maxAmountPrice)) {
      const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
      setMaxAmountPriceValue(maxCryptoAmount)
    }
  }, [amountToSend, asset, assetFee, maxAmount, network, poolDetails, pricePool])

  const priceFeeLabel = useMemo(() => {
    if (!feePriceValue) {
      return loadingString // or noDataString, depending on your needs
    }

    const fee = formatAssetAmountCurrency({
      amount: assetFee.assetAmount,
      asset: assetFee.asset,
      decimal: isUSDAsset(assetFee.asset) ? 2 : 6,
      trimZeros: !isUSDAsset(assetFee.asset)
    })

    const price = FP.pipe(
      O.some(feePriceValue), // Assuming this is Option<CryptoAmount>
      O.map((cryptoAmount: CryptoAmount) =>
        eqAsset(asset, cryptoAmount.asset)
          ? ''
          : formatAssetAmountCurrency({
              amount: cryptoAmount.assetAmount,
              asset: cryptoAmount.asset,
              decimal: isUSDAsset(cryptoAmount.asset) ? 2 : 6,
              trimZeros: !isUSDAsset(cryptoAmount.asset)
            })
      ),
      O.getOrElse(() => '')
    )

    return price ? `${price} (${fee}) ` : fee
  }, [feePriceValue, assetFee, asset])

  const amountLabel = useMemo(() => {
    if (!amountToSend) {
      return loadingString // or noDataString, depending on your needs
    }

    const amount = formatAssetAmountCurrency({
      amount: baseToAsset(amountToSend), // Find the value of swap slippage
      asset: asset,
      decimal: isUSDAsset(asset) ? 2 : 6,
      trimZeros: !isUSDAsset(asset)
    })

    const price = FP.pipe(
      O.some(amountPriceValue), // Assuming this is Option<CryptoAmount>
      O.map((cryptoAmount: CryptoAmount) =>
        eqAsset(asset, cryptoAmount.asset)
          ? ''
          : formatAssetAmountCurrency({
              amount: cryptoAmount.assetAmount,
              asset: cryptoAmount.asset,
              decimal: isUSDAsset(cryptoAmount.asset) ? 2 : 6,
              trimZeros: !isUSDAsset(cryptoAmount.asset)
            })
      ),
      O.getOrElse(() => '')
    )

    return price ? `${price} (${amount}) ` : amount
  }, [amountPriceValue, amountToSend, asset])

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
        msg3: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
      }
      return validateTxAmountInput({ input: value, maxAmount: baseToAsset(maxAmount), errors })
    },
    [intl, maxAmount]
  )

  const renderSlider = useMemo(() => {
    const percentage = amountToSend
      .amount()
      .dividedBy(maxAmount.amount())
      .multipliedBy(100)
      // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
      .decimalPlaces(0, BigNumber.ROUND_DOWN)
      .toNumber()

    const setAmountToSendFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmount.amount().multipliedBy(percents / 100)
      return setAmountToSend(baseAmount(amountFromPercentage, maxAmount.decimal))
    }

    return (
      <Slider
        key={'Send percentage slider'}
        value={percentage}
        onChange={setAmountToSendFromPercentValue}
        tooltipVisible
        tipFormatter={(value) => `${value}%`}
        withLabel
        tooltipPlacement={'top'}
        disabled={isLoading}
      />
    )
  }, [amountToSend, maxAmount, isLoading])

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const submitTx = useCallback(() => {
    setShowConfirmationModal(false)

    setSendTxStartTime(Date.now())

    subscribeSendTxState(
      transfer$({
        walletType,
        walletIndex,
        hdMode,
        sender: walletAddress,
        recipient: form.getFieldValue('recipient'),
        asset,
        amount: amountToSend,
        feeOption: selectedFeeOption,
        memo: currentMemo
      })
    )
  }, [
    subscribeSendTxState,
    transfer$,
    walletType,
    walletIndex,
    hdMode,
    walletAddress,
    form,
    asset,
    amountToSend,
    selectedFeeOption,
    currentMemo
  ])

  const renderConfirmationModal = useMemo(() => {
    const onSuccessHandler = () => {
      setShowConfirmationModal(false)
      submitTx()
    }

    const onCloseHandler = () => {
      setShowConfirmationModal(false)
    }

    if (isLedgerWallet(walletType)) {
      return (
        <LedgerConfirmationModal
          network={network}
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          visible={showConfirmationModal}
          chain={DOGEChain}
          description2={intl.formatMessage({ id: 'ledger.sign' })}
          addresses={O.none}
        />
      )
    } else if (isKeystoreWallet(walletType)) {
      return (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          validatePassword$={validatePassword$}
        />
      )
    } else {
      return null
    }
  }, [walletType, submitTx, network, showConfirmationModal, intl, validatePassword$])

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
        RD.map((fee) => [{ asset: AssetDOGE, amount: fee }])
      ),

    [feeRD]
  )

  const reloadFees = useCallback(() => {
    reloadFeesHandler(currentMemo)
  }, [currentMemo, reloadFeesHandler])

  // whenever the memo is updated call reload fees
  useEffect(() => {
    reloadFees()
  }, [currentMemo, reloadFees])

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          setAmountToSend(assetToBase(assetAmount(value)))
        })
        .catch(() => {}) // do nothing, Ant' form does the job for us to show an error message
    },
    [amountValidator]
  )

  const addMaxAmountHandler = useCallback(() => setAmountToSend(maxAmount), [maxAmount])

  const isMaxButtonDisabled = useMemo(
    () =>
      isLoading ||
      FP.pipe(
        selectedFee,
        O.fold(
          () => true,
          () => false
        )
      ),
    [isLoading, selectedFee]
  )

  const [recipientAddress, setRecipientAddress] = useState<Address>('')
  const handleOnKeyUp = useCallback(() => {
    setRecipientAddress(form.getFieldValue('recipient'))
  }, [form])

  const oMatchedWalletType: O.Option<WalletType> = useMemo(
    () => H.matchedWalletType(balances, recipientAddress),
    [balances, recipientAddress]
  )

  const renderFeeOptionsRadioGroup = useCallback(
    ({ rates }: FeesWithRates) => {
      const onChangeHandler = (e: RadioChangeEvent) => {
        // Change amount back to `none` (ZERO) whenever selected fee is changed
        // Just to avoid using a previous `max` value, which can be invalid now
        setAmountToSend(ZERO_BASE_AMOUNT)
        setSelectedFeeOption(e.target.value)
      }

      return (
        <StyledR.Radio.Group onChange={onChangeHandler} value={selectedFeeOption} disabled={isLoading}>
          {Object.keys(rates).map((key) => (
            <StyledR.Radio value={key as FeeOption} key={key}>
              <StyledR.RadioLabel>{feeOptionsLabel[key as FeeOption]}</StyledR.RadioLabel>
            </StyledR.Radio>
          ))}
        </StyledR.Radio.Group>
      )
    },

    [feeOptionsLabel, isLoading, selectedFeeOption]
  )

  const renderFeeOptions = useMemo(
    () =>
      FP.pipe(
        oFeesWithRates,
        O.fold(
          () =>
            // render radio group while reloading fees
            FP.pipe(
              prevFeesWithRatesRef.current,
              O.map(renderFeeOptionsRadioGroup),
              O.getOrElse(() => <></>)
            ),
          renderFeeOptionsRadioGroup
        )
      ),
    [prevFeesWithRatesRef, oFeesWithRates, renderFeeOptionsRadioGroup]
  )
  const [showDetails, setShowDetails] = useState<boolean>(true)
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
            feeRate: DEFAULT_FEE_OPTION
          }}
          onFinish={() => setShowConfirmationModal(true)}
          labelCol={{ span: 24 }}>
          <Styled.SubForm>
            <Styled.CustomLabel size="big">
              {intl.formatMessage({ id: 'common.address' })}
              {renderWalletType}
            </Styled.CustomLabel>
            <Form.Item rules={[{ required: true, validator: addressValidator }]} name="recipient">
              <Styled.Input color="primary" size="large" disabled={isLoading} onKeyUp={handleOnKeyUp} />
            </Form.Item>
            {warningMessage && <div className="pb-20px text-warning0 dark:text-warning0d ">{warningMessage}</div>}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.amount' })}</Styled.CustomLabel>
            <Styled.FormItem rules={[{ required: true, validator: amountValidator }]} name="amount">
              <InputBigNumber
                min={0}
                size="large"
                disabled={isLoading}
                decimal={DOGE_DECIMAL}
                onChange={onChangeInput}
              />
            </Styled.FormItem>
            <div className="mb-10px flex items-center">
              <MaxBalanceButton
                color="neutral"
                balance={{ amount: maxAmount, asset: AssetDOGE }}
                maxDollarValue={maxAmmountPriceValue}
                onClick={addMaxAmountHandler}
                disabled={isMaxButtonDisabled}
              />
              <InfoIcon color="warning" tooltip={intl.formatMessage({ id: 'wallet.send.max.doge' })} />
            </div>
            <div className="w-full px-20px pb-10px">{renderSlider}</div>
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFees} disabled={isLoading} />
            {renderFeeError}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
            <Form.Item name="memo">
              <Styled.Input size="large" disabled={isLoading} onChange={handleMemo} />
            </Form.Item>
            {swapMemoDetected && <div className="pb-20px text-warning0 dark:text-warning0d ">{affiliateTracking}</div>}
            <Form.Item name="feeRate">{renderFeeOptions}</Form.Item>
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
        <div className="w-full pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
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
                <ShowDetails
                  recipient={recipientAddress}
                  amountLabel={amountLabel}
                  priceFeeLabel={priceFeeLabel}
                  asset={asset}
                  currentMemo={currentMemo}
                />
              </>
            )}
          </div>
        </div>
      </Styled.Container>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
