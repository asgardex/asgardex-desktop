import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetails } from '@xchainjs/xchain-mayamidgard'
import { Address, baseAmount, CryptoAmount, eqAsset } from '@xchainjs/xchain-util'
import { formatAssetAmountCurrency, assetAmount, bn, assetToBase, BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import { Form } from 'antd'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { Dex, TrustedAddress, TrustedAddresses } from '../../../../../shared/api/types'
import { isChainOfMaya } from '../../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isMayaAsset, isUSDAsset } from '../../../../helpers/assetHelper'
import { getChainAsset } from '../../../../helpers/chainHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getPoolPriceValue } from '../../../../helpers/poolHelperMaya'
import { loadingString } from '../../../../helpers/stringHelper'
import { getCacaoAmountFromBalances } from '../../../../helpers/walletHelper'
import { calculateMayaValueInUSD, MayaScanPriceRD } from '../../../../hooks/useMayascanPrice'
import { usePricePool } from '../../../../hooks/usePricePool'
import { usePricePoolMaya } from '../../../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { FeeRD, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { PoolAddress } from '../../../../services/midgard/types'
import { SelectedWalletAsset, ValidatePasswordHandler } from '../../../../services/wallet/types'
import { WalletBalance } from '../../../../services/wallet/types'
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
  trustedAddresses: TrustedAddresses | undefined
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
  mayaScanPrice: MayaScanPriceRD
  poolDetails: PoolDetails
  oPoolAddress: O.Option<PoolAddress>
  dex: Dex
}

export const SendFormCOSMOS: React.FC<Props> = (props): JSX.Element => {
  const {
    asset: { walletType, walletAccount, walletIndex, hdMode },
    trustedAddresses,
    poolDetails,
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
    mayaScanPrice,
    oPoolAddress,
    dex
  } = props

  const intl = useIntl()

  const { asset } = balance

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = !isChainOfMaya(asset.chain) ? pricePoolThor : pricePoolMaya

  const mayascanPriceInUsd = calculateMayaValueInUSD(balance.amount, mayaScanPrice)

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
  const [recipientAddress, setRecipientAddress] = useState<Address>('')
  const isChainAsset = asset.chain === getChainAsset(asset.chain).chain
  const [warningMessage, setWarningMessage] = useState<string>('')
  const [form] = Form.useForm<FormValues>()
  const [showDetails, setShowDetails] = useState<boolean>(true)
  const [currentMemo, setCurrentMemo] = useState<string>('')
  const [swapMemoDetected, setSwapMemoDetected] = useState<boolean>(false)
  const [affiliateTracking, setAffiliateTracking] = useState<string>('')

  const oSavedAddresses: O.Option<TrustedAddress[]> = useMemo(
    () =>
      FP.pipe(O.fromNullable(trustedAddresses?.addresses), O.map(A.filter((address) => address.chain === asset.chain))),
    [trustedAddresses, asset.chain]
  )

  const handleMemo = useCallback(() => {
    let memoValue = form.getFieldValue('memo') as string

    // Check if a swap memo is detected
    if (H.checkMemo(memoValue)) {
      memoValue = H.memoCorrection(memoValue)
      setSwapMemoDetected(true)

      // Set affiliate tracking message
      setAffiliateTracking(intl.formatMessage({ id: 'wallet.send.affiliateTracking' }))
    } else {
      setSwapMemoDetected(false)
    }

    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [form, intl])

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const oAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset
    if (isChainAsset) {
      return O.some(balance.amount)
    }
    // or check list of other assets to get balance
    return FP.pipe(getCacaoAmountFromBalances(balances, getChainAsset(asset.chain)), O.map(assetToBase))
  }, [asset.chain, balance.amount, balances, isChainAsset])

  const isFeeError = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oFee, oAssetAmount),
      O.fold(
        // Missing (or loading) fees does not mean we can't sent something. No error then.
        () => false,
        ([fee, assetAmount]) => assetAmount.lt(fee)
      )
    )
  }, [oAssetAmount, oFee])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const amount: BaseAmount = FP.pipe(
      oAssetAmount,
      // no eth asset == zero amount
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const msg = intl.formatMessage(
      { id: 'wallet.errors.fee.notCovered' },
      {
        balance: formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset: getChainAsset(asset.chain),
          trimZeros: true
        })
      }
    )

    return (
      <Styled.Label size="big" color="error">
        {msg}
      </Styled.Label>
    )
  }, [isFeeError, oAssetAmount, intl, asset.chain])
  const { inboundAddress } = useMemo(() => {
    return FP.pipe(
      oPoolAddress,
      O.fold(
        () => ({
          inboundAddress: { THOR: '' },
          routers: { THOR: O.none }
        }),
        (poolDetails) => {
          const inboundAddress = {
            THOR: poolDetails.address
          }
          const routers = {
            THOR: poolDetails.router
          }
          return { inboundAddress, routers }
        }
      )
    )
  }, [oPoolAddress])

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      if (!value) {
        setWarningMessage('')
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      if (!addressValidation(value.toLowerCase())) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }
      if (inboundAddress.THOR === value) {
        const type = 'Inbound'
        setWarningMessage(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type: type }))
      } else {
        setWarningMessage('')
      }
    },
    [inboundAddress, addressValidation, intl]
  )

  const [matchedAddresses, setMatchedAddresses] = useState<O.Option<TrustedAddress[]>>(O.none)

  const handleSavedAddressSelect = useCallback(
    (value: string) => {
      form.setFieldsValue({ recipient: value })

      setRecipientAddress(value)

      if (value) {
        const matched = FP.pipe(
          oSavedAddresses,
          O.map((addresses) => addresses.filter((address) => address.address.includes(value))),
          O.chain(O.fromPredicate((filteredAddresses) => filteredAddresses.length > 0))
        )
        setMatchedAddresses(matched)
      }

      addressValidator(undefined, value).catch(() => {})
    },
    [form, addressValidator, oSavedAddresses]
  )

  const renderSavedAddressesDropdown = useMemo(
    () =>
      FP.pipe(
        oSavedAddresses,
        O.fold(
          () => null,
          (addresses) => (
            <Form.Item label={intl.formatMessage({ id: 'common.savedAddresses' })} className="mb-20px">
              <Styled.CustomSelect
                placeholder={intl.formatMessage({ id: 'common.savedAddresses' })}
                onChange={(value) => handleSavedAddressSelect(value as string)}
                style={{ width: '100%' }}>
                {addresses.map((address) => (
                  <Styled.CustomSelect.Option key={address.address} value={address.address}>
                    {address.name}: {address.address}
                  </Styled.CustomSelect.Option>
                ))}
              </Styled.CustomSelect>
            </Form.Item>
          )
        )
      ),
    [oSavedAddresses, intl, handleSavedAddressSelect]
  )

  const handleAddressInput = useCallback(async () => {
    const recipient = form.getFieldValue('recipient')
    setRecipientAddress(recipient)

    if (recipient) {
      const matched = FP.pipe(
        oSavedAddresses,
        O.map((addresses) => addresses.filter((address) => address.address.includes(recipient))),
        O.chain(O.fromPredicate((filteredAddresses) => filteredAddresses.length > 0)) // Use O.none for empty arrays
      )
      setMatchedAddresses(matched)
    }
  }, [form, oSavedAddresses])
  // max amount for asset
  const maxAmount: BaseAmount = useMemo(() => {
    const maxAmount = FP.pipe(
      sequenceTOption(oFee, oAssetAmount),
      O.fold(
        () => ZERO_BASE_AMOUNT,
        ([fee, assetAmount]) => {
          const max = isChainAsset ? assetAmount.minus(fee) : balance.amount
          const zero = baseAmount(0, max.decimal)
          return max.gt(zero) ? max : zero
        }
      )
    )
    return maxAmount
  }, [oFee, oAssetAmount, isChainAsset, balance.amount])

  // store maxAmountValue wrong CryptoAmount
  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, balance.amount.decimal), asset)
  )

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

    const price = isMayaAsset(asset)
      ? RD.isSuccess(amountToSendMayaPrice)
        ? formatAssetAmountCurrency({
            amount: amountToSendMayaPrice.value.assetAmount,
            asset: amountToSendMayaPrice.value.asset,
            decimal: isUSDAsset(amountToSendMayaPrice.value.asset) ? 2 : 6,
            trimZeros: !isUSDAsset(amountToSendMayaPrice.value.asset)
          })
        : ''
      : FP.pipe(
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
        msg3: isMayaAsset(asset)
          ? intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
          : intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
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
        walletAccount,
        walletIndex,
        recipient,
        asset,
        amount: amountToSend,
        memo: form.getFieldValue('memo'),
        hdMode,
        dex
      })
    )
  }, [
    recipientAddress,
    subscribeSendTxState,
    transfer$,
    walletType,
    walletAccount,
    walletIndex,
    asset,
    amountToSend,
    form,
    hdMode,
    dex
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
          chain={asset.chain}
          description2={intl.formatMessage({ id: 'ledger.sign' })}
          addresses={O.none}
        />
      )
    }
    return null
  }, [walletType, submitTx, validatePassword$, network, showConfirmationModal, asset.chain, intl])

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
          setAssetFee(new CryptoAmount(fee, getChainAsset(asset.chain)))
          return [{ asset: getChainAsset(asset.chain), amount: fee }]
        })
      ),

    [asset, feeRD]
  )

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          setAmountToSend(assetToBase(assetAmount(value, balance.amount.decimal)))
        })
        .catch(() => {}) // do nothing, Ant' form does the job for us to show an error message
    },
    [amountValidator, balance.amount.decimal]
  )

  const addMaxAmountHandler = useCallback(() => setAmountToSend(maxAmount), [maxAmount])

  const oMatchedWalletType: O.Option<WalletType> = useMemo(
    () => H.matchedWalletType(balances, recipientAddress),
    [balances, recipientAddress]
  )

  const renderWalletType = useMemo(
    () => H.renderedWalletType(oMatchedWalletType, matchedAddresses),
    [matchedAddresses, oMatchedWalletType]
  )
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
            {renderSavedAddressesDropdown}
            <Styled.CustomLabel size="big">
              {intl.formatMessage({ id: 'common.address' })}
              {renderWalletType}
            </Styled.CustomLabel>

            <Form.Item rules={[{ required: true, validator: addressValidator }]} name="recipient">
              <Styled.Input color="primary" size="large" disabled={isLoading} onChange={handleAddressInput} />
            </Form.Item>
            {warningMessage && <div className="pb-20px text-warning0 dark:text-warning0d ">{warningMessage}</div>}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.amount' })}</Styled.CustomLabel>
            <Styled.FormItem rules={[{ required: true, validator: amountValidator }]} name="amount">
              <InputBigNumber
                min={0}
                size="large"
                disabled={isLoading}
                decimal={balance.amount.decimal}
                onChange={onChangeInput}
              />
            </Styled.FormItem>
            <MaxBalanceButton
              className="mb-10px "
              color="neutral"
              balance={{ amount: maxAmount, asset: asset }}
              maxDollarValue={
                isMayaAsset(asset)
                  ? RD.isSuccess(mayascanPriceInUsd)
                    ? mayascanPriceInUsd.value
                    : maxAmountPriceValue
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
            {swapMemoDetected && <div className="pb-20px text-warning0 dark:text-warning0d ">{affiliateTracking}</div>}
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
