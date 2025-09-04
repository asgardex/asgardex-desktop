import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { PoolDetails } from '@xchainjs/xchain-mayamidgard'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  AssetType,
  baseAmount,
  CryptoAmount,
  eqAsset,
  formatAssetAmountCurrency,
  assetAmount,
  bn,
  assetToBase,
  BaseAmount,
  baseToAsset
} from '@xchainjs/xchain-util'
import { Form } from 'antd'
import BigNumber from 'bignumber.js'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { TrustedAddress, TrustedAddresses } from '../../../../../shared/api/types'
import { isChainOfMaya } from '../../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isMayaAsset, isUSDAsset } from '../../../../helpers/assetHelper'
import { getChainAsset } from '../../../../helpers/chainHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getPoolPriceValue } from '../../../../helpers/poolHelperMaya'
import { loadingString } from '../../../../helpers/stringHelper'
import { getAmountFromBalances } from '../../../../helpers/walletHelper'
import { calculateMayaValueInUSD, MayaScanPriceRD } from '../../../../hooks/useMayascanPrice'
import { usePricePool } from '../../../../hooks/usePricePool'
import { usePricePoolMaya } from '../../../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { FeeRD, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { PoolAddress } from '../../../../services/midgard/midgardTypes'
import { SelectedWalletAsset, ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
import { Input, InputBigNumber } from '../../../uielements/input'
import { ShowDetails } from '../../../uielements/showDetails'
import { Slider } from '../../../uielements/slider'
import { AccountSelector } from '../../account'
import * as H from '../TxForm.helpers'
import * as Styled from '../TxForm.styles'
import { validateTxAmountInput } from '../TxForm.util'
import * as Shared from './Send.shared'

type FormValues = {
  recipient: string
  amount: BigNumber
  memo?: string
}

type Props = {
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
}

export const SendFormCOSMOS = (props: Props): JSX.Element => {
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
    oPoolAddress
  } = props

  const intl = useIntl()

  const { asset } = balance
  const { walletAddress: sender } = balance
  const chainAsset = getChainAsset(
    asset.type === AssetType.SYNTH ? MAYAChain : asset.type === AssetType.SECURED ? THORChain : asset.chain
  )

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
  const isChainAsset = asset === chainAsset
  const [warningMessage, setWarningMessage] = useState<string>('')
  const [form] = Form.useForm<FormValues>()
  const [showDetails, setShowDetails] = useState<boolean>(true)
  const [currentMemo, setCurrentMemo] = useState<string>('')

  const oSavedAddresses: O.Option<TrustedAddress[]> = useMemo(
    () =>
      FP.pipe(
        O.fromNullable(trustedAddresses?.addresses),
        O.map(A.filter((address) => address.chain === chainAsset.chain))
      ),
    [trustedAddresses?.addresses, chainAsset.chain]
  )

  const handleMemo = useCallback(() => {
    const memoValue = form.getFieldValue('memo') as string
    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [form])

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  // Balance of the asset being sent (e.g., USDC, ATOM, etc.)
  const oAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    return O.some(balance.amount)
  }, [balance.amount])

  // Balance of the chain's native asset (used for paying transaction fees)
  const oChainAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    if (isChainAsset) {
      // If sending the chain asset itself, use the same balance
      return O.some(balance.amount)
    }
    // Otherwise, get the chain asset balance from balances list
    return FP.pipe(getAmountFromBalances(balances, balance.walletType, chainAsset), O.map(assetToBase))
  }, [balance.amount, balance.walletType, balances, chainAsset, isChainAsset])

  const isFeeError = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oFee, oChainAssetAmount),
      O.fold(
        // Missing (or loading) fees does not mean we can't sent something. No error then.
        () => false,
        ([fee, assetAmount]) => {
          return assetAmount.lt(fee)
        }
      )
    )
  }, [oChainAssetAmount, oFee])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const amount: BaseAmount = FP.pipe(
      oChainAssetAmount,
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
  }, [isFeeError, oChainAssetAmount, intl, asset.chain])
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
      if (!addressValidation(value)) {
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

  const updateMatchedAddresses = useCallback(
    (value: string) => {
      const matched = Shared.filterMatchedAddresses(oSavedAddresses, value)
      setMatchedAddresses(matched)
    },
    [oSavedAddresses]
  )

  const handleSavedAddressSelect = useCallback(
    (value: string) => {
      form.setFieldsValue({ recipient: value })
      setRecipientAddress(value)
      updateMatchedAddresses(value)
      addressValidator(undefined, value).catch(() => {})
    },
    [form, addressValidator, updateMatchedAddresses]
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
                className="w-full"
                placeholder={intl.formatMessage({ id: 'common.savedAddresses' })}
                onChange={(value) => handleSavedAddressSelect(value as string)}>
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
    updateMatchedAddresses(recipient)
  }, [form, updateMatchedAddresses])
  // max amount for asset
  const maxAmount: BaseAmount = useMemo(() => {
    // Some chains require minimum account reserves that cannot be spent
    const getMinimumAccountReserve = (): BaseAmount => {
      switch (asset.chain) {
        case XRPChain:
          // XRP requires 1 minimum reserve - use correct decimal precision
          return assetToBase(assetAmount(1, balance.amount.decimal))
        default:
          return baseAmount(0, balance.amount.decimal)
      }
    }

    const accountReserve = getMinimumAccountReserve()

    // If we have both fee and asset amount, calculate precise max
    return FP.pipe(
      sequenceTOption(oFee, oAssetAmount),
      O.fold(
        () => {
          // Fallback: if fee is unavailable, only subtract account reserve for chain assets
          // Don't subtract arbitrary fee estimates to avoid mixing units
          const fallbackMax = isChainAsset ? balance.amount.minus(accountReserve) : balance.amount
          const zero = baseAmount(0, balance.amount.decimal)
          return fallbackMax.gt(zero) ? fallbackMax : zero
        },
        ([fee, assetAmount]) => {
          const max = isChainAsset ? assetAmount.minus(fee).minus(accountReserve) : balance.amount
          const zero = baseAmount(0, max.decimal)
          return max.gt(zero) ? max : zero
        }
      )
    )
  }, [oFee, oAssetAmount, isChainAsset, balance.amount, asset.chain])

  // store maxAmountValue wrong CryptoAmount
  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, balance.amount.decimal), asset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    const maxAmountPrice = getPoolPriceValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool,
      mayaPriceRD: mayaScanPrice
    })

    const assetFeePrice = getPoolPriceValue({
      balance: { asset: chainAsset, amount: assetFee.baseAmount },
      poolDetails,
      pricePool,
      mayaPriceRD: mayaScanPrice
    })
    const amountPrice = getPoolPriceValue({
      balance: { asset, amount: amountToSend },
      poolDetails,
      pricePool,
      mayaPriceRD: mayaScanPrice
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
  }, [amountToSend, asset, assetFee, maxAmount, pricePool, network, poolDetails, mayaScanPrice, chainAsset])

  const priceFeeLabel = useMemo(() => {
    if (!feePriceValue) {
      return loadingString // or noDataString, depending on your needs
    }

    // Use more decimals for very small USD amounts to avoid showing $0.00
    const isFeeVerySmallUSDAmount = isUSDAsset(assetFee.asset) && assetFee.assetAmount.amount().lt(0.01)
    const feeDecimalPlaces = isUSDAsset(assetFee.asset) ? (isFeeVerySmallUSDAmount ? 6 : 2) : 6
    const fee = formatAssetAmountCurrency({
      amount: assetFee.assetAmount,
      asset: assetFee.asset,
      decimal: feeDecimalPlaces,
      trimZeros: !isUSDAsset(assetFee.asset)
    })

    const price = FP.pipe(
      O.some(feePriceValue), // Assuming this is Option<CryptoAmount>
      O.map((cryptoAmount: CryptoAmount) =>
        eqAsset(asset, cryptoAmount.asset)
          ? ''
          : (() => {
              // Use more decimals for very small USD amounts to avoid showing $0.00
              const isVerySmallUSDAmount = isUSDAsset(cryptoAmount.asset) && cryptoAmount.assetAmount.amount().lt(0.01)
              const decimalPlaces = isUSDAsset(cryptoAmount.asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6
              return formatAssetAmountCurrency({
                amount: cryptoAmount.assetAmount,
                asset: cryptoAmount.asset,
                decimal: decimalPlaces,
                trimZeros: !isUSDAsset(cryptoAmount.asset)
              })
            })()
      ),
      O.getOrElse(() => '')
    )

    return price ? `${price} (${fee}) ` : fee
  }, [feePriceValue, assetFee.assetAmount, assetFee.asset, asset])

  const amountLabel = useMemo(() => {
    if (!amountToSend) {
      return loadingString // or noDataString, depending on your needs
    }

    // Use more decimals for very small USD amounts to avoid showing $0.00
    const assetAmount = baseToAsset(amountToSend)
    const isVerySmallUSDAmount = isUSDAsset(asset) && assetAmount.amount().lt(0.01)
    const decimalPlaces = isUSDAsset(asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6
    const amount = formatAssetAmountCurrency({
      amount: assetAmount, // Find the value of swap slippage
      asset: asset,
      decimal: decimalPlaces,
      trimZeros: !isUSDAsset(asset)
    })

    const price = isMayaAsset(asset)
      ? RD.isSuccess(amountToSendMayaPrice)
        ? (() => {
            // Use more decimals for very small USD amounts to avoid showing $0.00
            const isVerySmallUSDAmount =
              isUSDAsset(amountToSendMayaPrice.value.asset) && amountToSendMayaPrice.value.assetAmount.amount().lt(0.01)
            const decimalPlaces = isUSDAsset(amountToSendMayaPrice.value.asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6
            return formatAssetAmountCurrency({
              amount: amountToSendMayaPrice.value.assetAmount,
              asset: amountToSendMayaPrice.value.asset,
              decimal: decimalPlaces,
              trimZeros: !isUSDAsset(amountToSendMayaPrice.value.asset)
            })
          })()
        : ''
      : FP.pipe(
          O.some(amountPriceValue), // Assuming this is Option<CryptoAmount>
          O.map((cryptoAmount: CryptoAmount) =>
            eqAsset(asset, cryptoAmount.asset)
              ? ''
              : (() => {
                  // Use more decimals for very small USD amounts to avoid showing $0.00
                  const isVerySmallUSDAmount =
                    isUSDAsset(cryptoAmount.asset) && cryptoAmount.assetAmount.amount().lt(0.01)
                  const decimalPlaces = isUSDAsset(cryptoAmount.asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6
                  return formatAssetAmountCurrency({
                    amount: cryptoAmount.assetAmount,
                    asset: cryptoAmount.asset,
                    decimal: decimalPlaces,
                    trimZeros: !isUSDAsset(cryptoAmount.asset)
                  })
                })()
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
    const maxAmountValue = maxAmount.amount()
    const percentage = maxAmountValue.gt(0)
      ? amountToSend
          .amount()
          .dividedBy(maxAmountValue)
          .multipliedBy(100)
          // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
          .decimalPlaces(0, BigNumber.ROUND_DOWN)
          .toNumber()
      : 0

    const setAmountToSendFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmountValue.multipliedBy(percents / 100)
      return setAmountToSend(baseAmount(amountFromPercentage, maxAmount.decimal))
    }

    return (
      <Slider
        key={'Send percentage slider'}
        value={percentage}
        onChange={setAmountToSendFromPercentValue}
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
        sender,
        asset,
        amount: amountToSend,
        memo: form.getFieldValue('memo'),
        hdMode
      })
    )
  }, [
    recipientAddress,
    subscribeSendTxState,
    transfer$,
    walletType,
    walletAccount,
    walletIndex,
    sender,
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
          setAssetFee(new CryptoAmount(fee, chainAsset))
          return [{ asset: chainAsset, amount: fee }]
        })
      ),

    [chainAsset, feeRD]
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
              <Input size="large" disabled={isLoading} onChange={handleAddressInput} />
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
                isMayaAsset(asset) && RD.isSuccess(mayascanPriceInUsd) ? mayascanPriceInUsd.value : maxAmountPriceValue
              }
              onClick={addMaxAmountHandler}
              disabled={isLoading}
            />
            <div className="w-full py-2">{renderSlider}</div>
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
            {renderFeeError}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
            <Form.Item name="memo">
              <Input size="large" disabled={isLoading} onChange={handleMemo} />
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
            <div className="my-20px w-full font-main text-[12px] uppercase dark:border-gray1d">
              <BaseButton
                className="group flex w-full justify-between !p-0 font-mainSemiBold text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
                onClick={() => setShowDetails((current) => !current)}>
                {intl.formatMessage({ id: 'common.details' })}
                {showDetails ? (
                  <MagnifyingGlassMinusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
                ) : (
                  <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125 " />
                )}
              </BaseButton>

              {showDetails && (
                <ShowDetails
                  recipient={recipientAddress}
                  amountLabel={amountLabel}
                  priceFeeLabel={priceFeeLabel}
                  currentMemo={currentMemo}
                  asset={asset}
                />
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
