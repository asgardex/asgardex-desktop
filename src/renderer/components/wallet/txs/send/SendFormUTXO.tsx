import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { FeeOption, FeesWithRates, Network } from '@xchainjs/xchain-client'
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
import BigNumber from 'bignumber.js'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useForm, Controller } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { TrustedAddress, TrustedAddresses } from '../../../../../shared/api/types'
import { isChainOfMaya, isChainOfThor } from '../../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isUSDAsset, isUtxoAssetChain } from '../../../../helpers/assetHelper'
import { getChainFeeBounds } from '../../../../helpers/chainHelper'
import { getPoolPriceValue } from '../../../../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../../../../helpers/poolHelperMaya'
import { loadingString } from '../../../../helpers/stringHelper'
import { MayaScanPriceRD } from '../../../../hooks/useMayascanPrice'
import { usePricePool } from '../../../../hooks/usePricePool'
import { usePricePoolMaya } from '../../../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { FeeRD, Memo, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { PoolDetails as PoolDetailsMaya } from '../../../../services/midgard/mayaMigard/types'
import { PoolAddress, PoolDetails } from '../../../../services/midgard/midgardTypes'
import { FeesWithRatesRD } from '../../../../services/utxo/types'
import { SelectedWalletAsset, ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
import { Input, InputBigNumber } from '../../../uielements/input'
import { Label } from '../../../uielements/label'
import { RadioGroup, Radio } from '../../../uielements/radio'
import { ShowDetails } from '../../../uielements/showDetails'
import { Slider } from '../../../uielements/slider'
import { AccountSelector } from '../../account'
import { matchedWalletType, renderedWalletType } from '../TxForm.helpers'
import * as Styled from '../TxForm.styles'
import { validateTxAmountInput } from '../TxForm.util'
import { DEFAULT_FEE_OPTION } from './Send.const'
import * as Shared from './Send.shared'

type FormValues = {
  recipient: string
  amount: BigNumber
  memo?: string
  feeRate?: FeeOption
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
  feesWithRates: FeesWithRatesRD
  reloadFeesHandler: (memo?: Memo) => void
  validatePassword$: ValidatePasswordHandler
  network: Network
  poolDetails: PoolDetails | PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
  oPoolAddressMaya: O.Option<PoolAddress>
  mayaScanPrice: MayaScanPriceRD
}

export const SendFormUTXO = (props: Props): JSX.Element => {
  const {
    asset: { walletType, walletAccount, walletIndex, hdMode, walletAddress },
    trustedAddresses,
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
    oPoolAddress,
    oPoolAddressMaya,
    network,
    mayaScanPrice
  } = props

  const intl = useIntl()

  const { asset } = balance

  const oSavedAddresses: O.Option<TrustedAddress[]> = useMemo(
    () =>
      FP.pipe(O.fromNullable(trustedAddresses?.addresses), O.map(A.filter((address) => address.chain === asset.chain))),
    [trustedAddresses, asset.chain]
  )

  // Initialize react-hook-form
  const {
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: {
      recipient: '',
      amount: bn(0),
      memo: '',
      feeRate: DEFAULT_FEE_OPTION
    },
    mode: 'onChange'
  })

  const handleSavedAddressSelect = useCallback(
    (value: string) => {
      setValue('recipient', value)
      setRecipientAddress(value)
      const matched = Shared.filterMatchedAddresses(oSavedAddresses, value)
      setMatchedAddresses(matched)
    },
    [setValue, oSavedAddresses]
  )

  const renderSavedAddressesDropdown = useMemo(
    () =>
      FP.pipe(
        oSavedAddresses,
        O.fold(
          () => null,
          (addresses) => (
            <div>
              <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.savedAddresses' })}</Styled.CustomLabel>
              <Shared.SavedAddressSelect
                placeholder={intl.formatMessage({ id: 'common.savedAddresses' })}
                addresses={addresses}
                onChange={(value) => handleSavedAddressSelect(value as string)}
              />
            </div>
          )
        )
      ),
    [oSavedAddresses, intl, handleSavedAddressSelect]
  )

  const [amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = !isChainOfMaya(asset.chain) ? pricePoolThor : pricePoolMaya

  const {
    state: sendTxState,
    reset: resetSendTxState,
    subscribe: subscribeSendTxState
  } = useSubscriptionState<SendTxState>(INITIAL_SEND_STATE)

  const isLoading = useMemo(() => RD.isPending(sendTxState.status), [sendTxState.status])

  const [recipientAddress, setRecipientAddress] = useState<Address>('')

  const [selectedFeeOptionKey, setSelectedFeeOptionKey] = useState<FeeOption>(DEFAULT_FEE_OPTION)

  const [feeRate, setFeeRate] = useState<number>(0)
  const [amountPriceValue, setAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  const [feePriceValue, setFeePriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  const [warningMessage, setWarningMessage] = useState<string>('')
  const [showDetails, setShowDetails] = useState<boolean>(true)

  const [currentMemo, setCurrentMemo] = useState<string>('')

  const handleMemo = useCallback(() => {
    const memoValue = watch('memo') as string
    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [watch])

  const prevFeesWithRatesRef = useRef<O.Option<FeesWithRates>>(O.none)

  const feeRD: FeeRD = useMemo(
    () =>
      FP.pipe(
        feesWithRatesRD,
        RD.map(({ fees }) => {
          return fees[selectedFeeOptionKey]
        })
      ),
    [feesWithRatesRD, selectedFeeOptionKey]
  )

  const oFeesWithRates: O.Option<FeesWithRates> = useMemo(
    () => FP.pipe(feesWithRatesRD, RD.toOption),
    [feesWithRatesRD]
  )

  const feesAvailable = useMemo(() => O.isSome(oFeesWithRates), [oFeesWithRates])

  const { inboundAddress } = useMemo(() => {
    const inboundAddress = {
      THOR: FP.pipe(
        oPoolAddress,
        O.map((details) => details.address),
        O.getOrElse(() => '')
      ),
      MAYA: FP.pipe(
        oPoolAddressMaya,
        O.map((details) => details.address),
        O.getOrElse(() => '')
      )
    }
    return { inboundAddress }
  }, [oPoolAddress, oPoolAddressMaya])
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
        O.map(({ fees, rates }) => {
          const feeAmount = fees[selectedFeeOptionKey]
          const feeRate = rates[selectedFeeOptionKey]

          // Use the precise fee from getFeesWithRates instead of arbitrary rounding
          // Only round up the fee rate for transaction building, but use original fee amount
          const roundedFeeRate = Math.ceil(feeRate)
          setFeeRate(roundedFeeRate)

          // Use the precise fee amount calculated by xchain-js
          prevSelectedFeeRef.current = O.some(feeAmount)
          return feeAmount
        })
      ),
    [oFeesWithRates, selectedFeeOptionKey]
  )

  const oFeeBaseAmount: O.Option<BaseAmount> = useMemo(
    () =>
      FP.pipe(
        oFeesWithRates,
        O.map(({ fees }) => fees[selectedFeeOptionKey])
      ),
    [oFeesWithRates, selectedFeeOptionKey]
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
          asset: asset,
          trimZeros: true
        })
      }
    )

    return (
      <Styled.Label size="big" color="error">
        {msg}
      </Styled.Label>
    )
  }, [asset, balance.amount, intl, isFeeError])

  const feeOptionsLabel: Record<FeeOption, string> = useMemo(
    () => ({
      [FeeOption.Fast]: intl.formatMessage({ id: 'wallet.send.fast' }),
      [FeeOption.Fastest]: intl.formatMessage({ id: 'wallet.send.fastest' }),
      [FeeOption.Average]: intl.formatMessage({ id: 'wallet.send.average' })
    }),
    [intl]
  )

  const renderFeeOptionsRadioGroup = useCallback(
    ({ rates }: FeesWithRates) => {
      const onChangeHandler = (e: string) => setSelectedFeeOptionKey(e as FeeOption)
      return (
        <RadioGroup
          className="flex flex-col lg:flex-row lg:space-x-2"
          onChange={onChangeHandler}
          value={selectedFeeOptionKey}
          disabled={isLoading}>
          {Object.keys(rates).map((key) => (
            <Radio value={key as FeeOption} key={key}>
              <Label textTransform="uppercase">{feeOptionsLabel[key as FeeOption]}</Label>
            </Radio>
          ))}
        </RadioGroup>
      )
    },

    [feeOptionsLabel, isLoading, selectedFeeOptionKey]
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

  const addressValidator = useCallback(
    (value: string) => {
      console.log('addressValidator called with:', value)

      if (!value) {
        setWarningMessage('')
        const error = intl.formatMessage({ id: 'wallet.errors.address.empty' })
        console.log('Returning empty error:', error)
        return error
      }

      try {
        if (!addressValidation(value)) {
          const error = intl.formatMessage({ id: 'wallet.errors.address.invalid' })
          console.log('Returning invalid error:', error)
          return error
        }
      } catch (error) {
        // If addressValidation throws an error, it means the address is invalid
        const errorMsg = intl.formatMessage({ id: 'wallet.errors.address.invalid' })
        console.log('Caught error, returning:', errorMsg)
        return errorMsg
      }

      if (inboundAddress.THOR === value || inboundAddress.MAYA === value) {
        const dexInbound = inboundAddress.THOR === value ? 'Thorchain' : 'Mayachain'
        const type = `${dexInbound} ${asset.chain} Inbound`
        setWarningMessage(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type: type }))
      } else {
        setWarningMessage('')
      }
      console.log('Returning true (valid)')
      return true
    },
    [inboundAddress, addressValidation, asset, intl]
  )

  const maxAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        selectedFee,
        O.map((fee) => {
          // Add UTXO safety buffer to prevent dust issues (0.0001 BTC equivalent)
          const utxoSafetyBuffer = isUtxoAssetChain(asset)
            ? baseAmount(10000, balance.amount.decimal)
            : ZERO_BASE_AMOUNT
          const max = balance.amount.minus(fee).minus(utxoSafetyBuffer)
          const zero = baseAmount(0, max.decimal)
          return max.gt(zero) ? max : zero
        }),
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      ),
    [balance, selectedFee, asset]
  )

  // store maxAmountValue
  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  // useEffect to fetch data from query
  useEffect(() => {
    const maxAmountPrice = FP.pipe(
      isChainOfThor(asset.chain)
        ? getPoolPriceValue({
            balance: { asset, amount: maxAmount },
            poolDetails: poolDetails as PoolDetails,
            pricePool
          })
        : getPoolPriceValueM({
            balance: { asset, amount: maxAmount },
            poolDetails: poolDetails as PoolDetailsMaya,
            pricePool,
            mayaPriceRD: mayaScanPrice
          })
    )

    const amountPrice = FP.pipe(
      isChainOfThor(asset.chain)
        ? getPoolPriceValue({
            balance: { asset, amount: amountToSend },
            poolDetails: poolDetails as PoolDetails,
            pricePool
          })
        : getPoolPriceValueM({
            balance: { asset, amount: amountToSend },
            poolDetails: poolDetails as PoolDetailsMaya,
            pricePool,
            mayaPriceRD: mayaScanPrice
          })
    )

    const assetFeePrice = FP.pipe(
      selectedFee,
      O.fold(
        () => O.none, // Return `O.none` if `selectedFee` is `None`
        (fee) =>
          isChainOfThor(asset.chain)
            ? getPoolPriceValue({
                balance: { asset, amount: fee },
                poolDetails: poolDetails as PoolDetails,
                pricePool
              })
            : getPoolPriceValueM({
                balance: { asset, amount: fee },
                poolDetails: poolDetails as PoolDetailsMaya,
                pricePool,
                mayaPriceRD: mayaScanPrice
              })
      )
    )

    if (O.isSome(assetFeePrice)) {
      const assetAmountFeePrice = new CryptoAmount(assetFeePrice.value, pricePool.asset)
      setFeePriceValue(assetAmountFeePrice)
    }

    if (O.isSome(amountPrice)) {
      const amountPriceAmount = new CryptoAmount(amountPrice.value, pricePool.asset)
      setAmountPriceValue(amountPriceAmount)
    }

    if (O.isSome(maxAmountPrice)) {
      const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
      setMaxAmountPriceValue(maxCryptoAmount)
    }
  }, [amountToSend, asset, maxAmount, mayaScanPrice, network, poolDetails, pricePool, selectedFee])

  const priceFeeLabel = useMemo(() => {
    if (!feePriceValue) {
      return loadingString // or noDataString, depending on your needs
    }

    const fee = FP.pipe(
      selectedFee,
      O.fold(
        () => O.none, // Return `O.none` if `selectedFee` is `None`
        (fee) => {
          // Use more decimals for very small USD amounts to avoid showing $0.00
          const feeAmount = baseToAsset(fee)
          const isVerySmallUSDAmount = isUSDAsset(asset) && feeAmount.amount().lt(0.01)
          const decimalPlaces = isUSDAsset(asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6
          return O.some(
            formatAssetAmountCurrency({
              amount: feeAmount,
              asset: asset,
              decimal: decimalPlaces,
              trimZeros: !isUSDAsset(asset)
            })
          )
        }
      ),
      O.getOrElse(() => '')
    )

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
  }, [feePriceValue, selectedFee, asset])

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

    const price = FP.pipe(
      O.some(amountPriceValue), // Assuming this is Option<CryptoAmount>
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

    return price ? `${price} (${amount}) ` : amount
  }, [amountPriceValue, amountToSend, asset])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    setValue('amount', baseToAsset(amountToSend).amount())
  }, [amountToSend, setValue])

  const amountValidator = useCallback(
    async (value: BigNumber) => {
      const errors = {
        msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
        msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
        msg3: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
      }

      try {
        await validateTxAmountInput({ input: value, maxAmount: baseToAsset(maxAmount), errors })
        return true
      } catch (error) {
        return error as string
      }
    },
    [intl, maxAmount]
  )

  const renderSlider = useMemo(() => {
    const maxAmountValue = maxAmount.amount()
    const percentage = maxAmountValue.isZero()
      ? 0
      : amountToSend
          .amount()
          .dividedBy(maxAmountValue)
          .multipliedBy(100)
          // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
          .decimalPlaces(0, BigNumber.ROUND_DOWN)
          .toNumber()

    const setAmountToSendFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmount.amount().multipliedBy(percents / 100)
      const newAmount = baseAmount(amountFromPercentage, maxAmount.decimal)
      setAmountToSend(newAmount)
      // Also update the form field and trigger validation
      setValue('amount', baseToAsset(newAmount).amount(), { shouldValidate: true })
    }

    return (
      <Slider
        key={'Send percentage slider'}
        value={percentage}
        onChange={setAmountToSendFromPercentValue}
        disabled={isLoading}
      />
    )
  }, [amountToSend, maxAmount, isLoading, setValue])

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const submitTx = useCallback(() => {
    setSendTxStartTime(Date.now())

    subscribeSendTxState(
      transfer$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        sender: walletAddress,
        recipient: recipientAddress,
        asset,
        amount: amountToSend,
        feeOption: selectedFeeOptionKey,
        memo: currentMemo
      })
    )
  }, [
    subscribeSendTxState,
    transfer$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletAddress,
    recipientAddress,
    asset,
    amountToSend,
    selectedFeeOptionKey,
    currentMemo
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

    if (isLedgerWallet(walletType)) {
      return (
        <LedgerConfirmationModal
          network={network}
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          visible={showConfirmationModal}
          chain={asset.chain}
          description2={intl.formatMessage({ id: 'ledger.sign' })}
          addresses={O.some({ sender: walletAddress, recipient: watch('recipient') })}
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
  }, [walletType, submitTx, network, showConfirmationModal, asset.chain, intl, walletAddress, watch, validatePassword$])

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
        RD.map((fee) => [{ asset: asset, amount: fee }])
      ),

    [asset, feeRD]
  )

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      const validationResult = await amountValidator(value)
      if (validationResult === true) {
        setAmountToSend(assetToBase(assetAmount(value, balance.amount.decimal)))
      }
    },
    [amountValidator, balance.amount.decimal]
  )

  const onChangeAddress = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setRecipientAddress(value)
      const matched = Shared.filterMatchedAddresses(oSavedAddresses, value)
      setMatchedAddresses(matched)
    },
    [oSavedAddresses]
  )

  const reloadFees = useCallback(() => {
    reloadFeesHandler(currentMemo)
  }, [currentMemo, reloadFeesHandler])

  // whenever the memo is updated call reload fees
  useEffect(() => {
    reloadFees()
  }, [currentMemo, reloadFees])

  const addMaxAmountHandler = useCallback(() => {
    setAmountToSend(maxAmount)
    // Also update the form field and trigger validation
    setValue('amount', baseToAsset(maxAmount).amount(), { shouldValidate: true })
  }, [maxAmount, setValue])

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

  const [matchedAddresses, setMatchedAddresses] = useState<O.Option<TrustedAddress[]>>(O.none)

  const handleOnKeyUp = useCallback(async () => {
    const recipient = watch('recipient')
    setRecipientAddress(recipient)
    const matched = Shared.filterMatchedAddresses(oSavedAddresses, recipient)
    setMatchedAddresses(matched)
  }, [watch, oSavedAddresses])
  const oMatchedWalletType: O.Option<WalletType> = useMemo(
    () => matchedWalletType(balances, recipientAddress),
    [balances, recipientAddress]
  )

  const renderWalletType = useMemo(
    () => renderedWalletType(oMatchedWalletType, matchedAddresses),
    [oMatchedWalletType, matchedAddresses]
  )

  return (
    <>
      <Styled.Container>
        <AccountSelector selectedWallet={balance} network={network} />
        <form onSubmit={handleSubmit(() => setShowConfirmationModal(true))}>
          <Styled.SubForm>
            {renderSavedAddressesDropdown}
            <Styled.CustomLabel className="mt-2" size="big">
              {intl.formatMessage({ id: 'common.address' })}
              {renderWalletType}
            </Styled.CustomLabel>
            <div className="flex flex-col">
              <Controller
                name="recipient"
                control={control}
                rules={{
                  required: intl.formatMessage({ id: 'wallet.errors.address.empty' }),
                  validate: addressValidator
                }}
                render={({ field }) => (
                  <Input
                    size="large"
                    disabled={isLoading}
                    value={field.value || ''}
                    onChange={(e) => {
                      field.onChange(e)
                      onChangeAddress(e)
                    }}
                    onKeyUp={handleOnKeyUp}
                    error={!!errors.recipient}
                  />
                )}
              />
              {errors.recipient && (
                <span className="text-error0 dark:text-error0d text-xs mt-1">
                  {typeof errors.recipient === 'string' ? errors.recipient : errors.recipient.message}
                </span>
              )}
            </div>
            {warningMessage && <div className="pb-20px text-warning0 dark:text-warning0d ">{warningMessage}</div>}
            <Styled.CustomLabel className="mt-2" size="big">
              {intl.formatMessage({ id: 'common.amount' })}
            </Styled.CustomLabel>
            <div className="flex flex-col">
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
                  validate: amountValidator
                }}
                render={({ field }) => (
                  <InputBigNumber
                    min={0}
                    size="large"
                    disabled={isLoading}
                    decimal={balance.amount.decimal}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                      onChangeInput(value)
                    }}
                  />
                )}
              />
              {errors.amount && (
                <span className="text-error0 dark:text-error0d text-xs mt-1">{errors.amount.message}</span>
              )}
            </div>
            <MaxBalanceButton
              className="mb-10px"
              color="neutral"
              balance={{ amount: maxAmount, asset: asset }}
              maxDollarValue={maxAmountPriceValue}
              onClick={addMaxAmountHandler}
              disabled={isMaxButtonDisabled}
            />
            <div className="w-full py-2">{renderSlider}</div>
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFees} disabled={isLoading} />
            {renderFeeError}
            <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
            <div className="flex flex-col">
              <Controller
                name="memo"
                control={control}
                render={({ field }) => (
                  <Input
                    size="large"
                    disabled={isLoading}
                    value={field.value || ''}
                    onBlur={handleMemo}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="flex flex-col">
              <Controller name="feeRate" control={control} render={() => <div>{renderFeeOptions}</div>} />
            </div>
          </Styled.SubForm>
          <FlatButton
            className="mt-40px min-w-[200px] w-full"
            loading={isLoading}
            disabled={!feesAvailable || isLoading}
            type="submit"
            size="large">
            {intl.formatMessage({ id: 'wallet.action.send' })}
          </FlatButton>
        </form>
        <div className="w-full pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
          {/* memo */}
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
              <>
                <ShowDetails
                  recipient={recipientAddress}
                  amountLabel={amountLabel}
                  priceFeeLabel={priceFeeLabel}
                  upperFeeBound={getChainFeeBounds(asset.chain)}
                  feeRate={feeRate}
                  currentMemo={currentMemo}
                  asset={asset}
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
