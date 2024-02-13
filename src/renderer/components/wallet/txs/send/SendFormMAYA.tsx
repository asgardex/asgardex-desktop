import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { MAYA_DECIMAL, MAYAChain } from '@xchainjs/xchain-mayachain'
import { PoolDetails } from '@xchainjs/xchain-mayamidgard'
import { Address, baseAmount, CryptoAmount, eqAsset } from '@xchainjs/xchain-util'
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
import { isCacaoAsset, CACAO_DECIMAL, isUSDAsset, isMayaAsset } from '../../../../helpers/assetHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getPoolPriceValue } from '../../../../helpers/poolHelperMaya'
import { loadingString } from '../../../../helpers/stringHelper'
import { getCacaoAmountFromBalances } from '../../../../helpers/walletHelper'
import { calculateMayaValueInUSD, MayaScanPriceRD } from '../../../../hooks/useMayascanPrice'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { FeeRD, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { SelectedWalletAsset, ValidatePasswordHandler } from '../../../../services/wallet/types'
import { WalletBalance } from '../../../../services/wallet/types'
import { PricePool } from '../../../../views/pools/Pools.types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
import { InputBigNumber } from '../../../uielements/input'
import { ShowDetails } from '../../../uielements/showDetails'
import { Slider } from '../../../uielements/slider'
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
  poolDetails: PoolDetails
  pricePool: PricePool
  mayaScanPrice: MayaScanPriceRD
}

export const SendFormMAYA: React.FC<Props> = (props): JSX.Element => {
  const {
    asset: { walletType, walletIndex, hdMode },
    poolDetails,
    pricePool,
    balances,
    balance,
    transfer$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    addressValidation,
    fee: feeRD,
    reloadFeesHandler,
    validatePassword$,
    network,
    mayaScanPrice
  } = props

  const intl = useIntl()

  const { asset } = balance

  const mayascanPriceInUsd = calculateMayaValueInUSD(balance.amount, mayaScanPrice)

  const assetDecimal = isCacaoAsset(asset) ? CACAO_DECIMAL : MAYA_DECIMAL
  const [amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const amountToSendMayaPrice = calculateMayaValueInUSD(amountToSend, mayaScanPrice)
  const {
    state: sendTxState,
    reset: resetSendTxState,
    subscribe: subscribeSendTxState
  } = useSubscriptionState<SendTxState>(INITIAL_SEND_STATE)

  const isLoading = useMemo(() => RD.isPending(sendTxState.status), [sendTxState.status])

  const [assetFee, setAssetFee] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [feePriceValue, setFeePriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [amountPriceValue, setAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  const [form] = Form.useForm<FormValues>()
  const [showDetails, setShowDetails] = useState<boolean>(true)
  const [currentMemo, setCurrentMemo] = useState('')

  const handleMemo = useCallback(() => {
    const memoValue = form.getFieldValue('memo') as string

    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [form])

  const oCacaoAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset (if Cacao)
    if (isCacaoAsset(asset)) {
      return O.some(balance.amount)
    }
    // or check list of other assets to get Cacao balance
    return FP.pipe(balances, getCacaoAmountFromBalances, O.map(assetToBase))
  }, [asset, balance.amount, balances])

  const oMayaAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset (if Cacao)
    if (isMayaAsset(asset)) {
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
        ([fee, cacaoAmount]) => {
          const feeCover = cacaoAmount.lt(fee)
          return feeCover
        }
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
    const maxCacaoAmount = FP.pipe(
      sequenceTOption(oFee, isCacaoAsset(asset) ? oCacaoAmount : oMayaAmount),
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
    return isCacaoAsset(asset) ? maxCacaoAmount : balance.amount
  }, [oFee, asset, oCacaoAmount, oMayaAmount, balance.amount])

  // store maxAmountValue wrong CryptoAmount
  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, assetDecimal), asset)
  )

  // // useEffect to fetch data from query
  // useEffect to fetch data from query
  useEffect(() => {
    const maxAmountPrice = getPoolPriceValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool
    })

    const assetFeePrice = getPoolPriceValue({
      balance: { asset, amount: assetFee.baseAmount },
      poolDetails,
      pricePool
    })
    const amountPrice = getPoolPriceValue({
      balance: { asset, amount: amountToSend },
      poolDetails,
      pricePool
    })
    if (O.isSome(maxAmountPrice)) {
      const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
      setMaxAmountPriceValue(maxCryptoAmount)
    }
    if (O.isSome(assetFeePrice)) {
      const maxCryptoAmount = new CryptoAmount(assetFeePrice.value, pricePool.asset)
      setFeePriceValue(maxCryptoAmount)
    }
    if (O.isSome(amountPrice)) {
      const maxCryptoAmount = new CryptoAmount(amountPrice.value, pricePool.asset)
      setAmountPriceValue(maxCryptoAmount)
    }
  }, [amountToSend, asset, assetFee, maxAmount, pricePool, network, poolDetails, mayaScanPrice])

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
  }, [feePriceValue, assetFee.assetAmount, assetFee.asset, asset])

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

    const price = isCacaoAsset(asset)
      ? FP.pipe(
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
      : RD.isSuccess(amountToSendMayaPrice)
      ? formatAssetAmountCurrency({
          amount: amountToSendMayaPrice.value.assetAmount,
          asset: amountToSendMayaPrice.value.asset,
          decimal: isUSDAsset(amountToSendMayaPrice.value.asset) ? 2 : 6,
          trimZeros: !isUSDAsset(amountToSendMayaPrice.value.asset)
        })
      : ''

    return price ? `${price} (${amount}) ` : amount
  }, [amountPriceValue, amountToSend, amountToSendMayaPrice, asset])

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
        RD.map((fee) => {
          setAssetFee(new CryptoAmount(fee, AssetCacao))
          return [{ asset: AssetCacao, amount: fee }]
        })
      ),

    [feeRD]
  )

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          setAmountToSend(assetToBase(assetAmount(value, assetDecimal)))
        })
        .catch(() => {}) // do nothing, Ant' form does the job for us to show an error message
    },
    [amountValidator, assetDecimal]
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
                decimal={assetDecimal}
                onChange={onChangeInput}
              />
            </Styled.FormItem>
            <MaxBalanceButton
              className="mb-10px "
              color="neutral"
              balance={{ amount: maxAmount, asset: asset }}
              maxDollarValue={
                isCacaoAsset(asset)
                  ? maxAmountPriceValue
                  : RD.isSuccess(mayascanPriceInUsd)
                  ? mayascanPriceInUsd.value
                  : maxAmountPriceValue
              }
              onClick={addMaxAmountHandler}
              disabled={isLoading}
            />
            <div className="w-full px-20px pb-10px">{renderSlider}</div>
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
            {renderFeeError}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
            <Form.Item name="memo">
              <Styled.Input size="large" disabled={isLoading} onChange={handleMemo} />
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
          <div className="w-full pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
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
                    currentMemo={currentMemo}
                    asset={asset}
                  />
                </>
              )}
            </div>
          </div>
        </Styled.Form>
      </Styled.Container>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
