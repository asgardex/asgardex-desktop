import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { FeeOption, Fees, FeesWithRates, Network } from '@xchainjs/xchain-client'
import { validateAddress } from '@xchainjs/xchain-evm'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  assetAmount,
  assetToBase,
  BaseAmount,
  baseAmount,
  baseToAsset,
  bn,
  Chain,
  CryptoAmount,
  eqAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { array as A, function as FP, option as O } from 'fp-ts'
import { Controller, useForm } from 'react-hook-form'
import { FormattedMessage, useIntl } from 'react-intl'

import { TrustedAddress, TrustedAddresses } from '../../../../../shared/api/types'
import { isChainOfMaya, isChainOfThor } from '../../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT, ZERO_BN } from '../../../../const'
import { useXrpContext } from '../../../../contexts/XrpContext'
import { isMayaAsset, isUSDAsset, isUtxoAssetChain } from '../../../../helpers/assetHelper'
import { getChainAsset, getChainFeeBounds } from '../../../../helpers/chainHelper'
import { isEvmChain, isEvmChainAsset } from '../../../../helpers/evmHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getPoolPriceValue } from '../../../../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../../../../helpers/poolHelperMaya'
import { loadingString } from '../../../../helpers/stringHelper'
import { calculateMayaValueInUSD, MayaScanPriceRD } from '../../../../hooks/useMayascanPrice'
import { usePricePool } from '../../../../hooks/usePricePool'
import { usePricePoolMaya } from '../../../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_DEPOSIT_STATE, INITIAL_SEND_STATE } from '../../../../services/chain/const'
import {
  DepositState,
  DepositStateHandler,
  FeeRD,
  Memo,
  SendTxState,
  SendTxStateHandler
} from '../../../../services/chain/types'
import {
  AddressValidation,
  FeesRD,
  GetExplorerTxUrl,
  OpenExplorerTxUrl,
  WalletBalances
} from '../../../../services/clients'
import { TxParams } from '../../../../services/evm/types'
import { PoolDetails as PoolDetailsMaya } from '../../../../services/midgard/mayaMigard/types'
import { PoolAddress, PoolDetails } from '../../../../services/midgard/midgardTypes'
import { FeesWithRatesRD } from '../../../../services/utxo/types'
import { SelectedWalletAsset, ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { SwitchButton } from '../../../uielements/button/SwitchButton'
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
  fee?: FeeOption
  feeRate?: FeeOption
  destinationTag?: number
}

export type Props = {
  asset: SelectedWalletAsset
  trustedAddresses: TrustedAddresses | undefined
  balances: WalletBalances
  balance: WalletBalance
  transfer$: SendTxStateHandler
  deposit$?: DepositStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  addressValidation: AddressValidation
  // Chain-specific fee props
  fee?: FeeRD
  fees?: FeesRD
  feesWithRates?: FeesWithRatesRD
  reloadFeesHandler: ((params: TxParams) => void) | ((memo?: Memo) => void) | FP.Lazy<void>
  validatePassword$: ValidatePasswordHandler
  network: Network
  poolDetails: PoolDetails | PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
  oPoolAddressMaya?: O.Option<PoolAddress>
  mayaScanPrice: MayaScanPriceRD
}

export const SendForm = (props: Props): JSX.Element => {
  const {
    asset: { walletType, walletAccount, walletIndex, hdMode, walletAddress },
    trustedAddresses,
    poolDetails,
    balances,
    balance,
    transfer$,
    deposit$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    addressValidation,
    fee: feeRD,
    fees: feesRD,
    feesWithRates: feesWithRatesRD,
    reloadFeesHandler,
    validatePassword$,
    network,
    oPoolAddress,
    oPoolAddressMaya,
    mayaScanPrice
  } = props

  const intl = useIntl()

  const { asset } = balance
  const sourceChainAsset = getChainAsset(asset.chain)

  // Get XRP client for destination tag validation
  const xrpContext = useXrpContext()
  const isXrpChain = asset.chain === XRPChain

  // Chain type detection
  const isEVMChain = isEvmChain(asset.chain)
  const isUTXOChain = isUtxoAssetChain(asset)
  const isCOSMOSChain = !isEVMChain && !isUTXOChain

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = useMemo(
    () => (!isChainOfMaya(asset.chain) ? pricePoolThor : pricePoolMaya),
    [asset.chain, pricePoolThor, pricePoolMaya]
  )

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
      fee: DEFAULT_FEE_OPTION,
      feeRate: DEFAULT_FEE_OPTION,
      destinationTag: undefined
    },
    mode: 'onChange'
  })

  const [amountToSend, setAmountToSend] = useState<BaseAmount | O.Option<BaseAmount>>(
    isEVMChain ? O.none : ZERO_BASE_AMOUNT
  )
  const [recipientAddress, setRecipientAddress] = useState<Address | O.Option<Address>>(isEVMChain ? O.none : '')
  const [selectedFeeOption, setSelectedFeeOption] = useState<FeeOption>(DEFAULT_FEE_OPTION)
  const [selectedFeeOptionKey, setSelectedFeeOptionKey] = useState<FeeOption>(DEFAULT_FEE_OPTION)
  const [poolDeposit, setPoolDeposit] = useState<boolean>(false)
  const [oProtocol, _setProtocol] = useState<O.Option<Chain>>(O.none)
  const [warningMessage, setWarningMessage] = useState<string>('')
  const [showDetails, setShowDetails] = useState<boolean>(true)
  const [currentMemo, setCurrentMemo] = useState<string>('')
  const [matchedAddresses, setMatchedAddresses] = useState<O.Option<TrustedAddress[]>>(O.none)
  const [_notAllowed, _setNotAllowed] = useState<boolean>(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [destinationTagRequired, setDestinationTagRequired] = useState<boolean>(false)
  const [isRouterAddress, setIsRouterAddress] = useState<boolean>(false)

  const [assetFee, setAssetFee] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [feePriceValue, setFeePriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [amountPriceValue, setAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [feeRate, setFeeRate] = useState<number>(0)

  const _mayascanPriceInUsd = calculateMayaValueInUSD(balance.amount, mayaScanPrice)
  const amountToSendMayaPrice = useMemo(() => {
    const amount = isEVMChain
      ? O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)
      : (amountToSend as BaseAmount)
    return calculateMayaValueInUSD(amount, mayaScanPrice)
  }, [amountToSend, mayaScanPrice, isEVMChain])

  const {
    state: sendTxState,
    reset: resetSendTxState,
    subscribe: subscribeSendTxState
  } = useSubscriptionState<SendTxState>(INITIAL_SEND_STATE)

  const {
    state: depositState,
    reset: resetDepositState,
    subscribe: subscribeDepositState
  } = useSubscriptionState<DepositState>(INITIAL_DEPOSIT_STATE)

  const isLoading = useMemo(() => RD.isPending(sendTxState.status), [sendTxState.status])

  const oSavedAddresses: O.Option<TrustedAddress[]> = useMemo(
    () =>
      FP.pipe(O.fromNullable(trustedAddresses?.addresses), O.map(A.filter((address) => address.chain === asset.chain))),
    [trustedAddresses?.addresses, asset.chain]
  )

  const oFees: O.Option<Fees> = useMemo(() => {
    if (isEVMChain && feesRD) {
      return FP.pipe(feesRD, RD.toOption)
    }
    return O.none
  }, [isEVMChain, feesRD])

  const oFeesWithRates: O.Option<FeesWithRates> = useMemo(() => {
    if (isUTXOChain && feesWithRatesRD) {
      return FP.pipe(feesWithRatesRD, RD.toOption) as O.Option<FeesWithRates>
    }
    return O.none
  }, [isUTXOChain, feesWithRatesRD])

  const oFee: O.Option<BaseAmount> = useMemo(() => {
    if (isCOSMOSChain && feeRD) {
      return FP.pipe(feeRD, RD.toOption)
    }
    return O.none
  }, [isCOSMOSChain, feeRD])

  const selectedFee: O.Option<BaseAmount> = useMemo(() => {
    if (isEVMChain) {
      return FP.pipe(
        oFees,
        O.map((fees) => {
          setAssetFee(new CryptoAmount(fees[selectedFeeOption], getChainAsset(asset.chain)))
          return fees[selectedFeeOption]
        })
      )
    }
    if (isUTXOChain) {
      return FP.pipe(
        oFeesWithRates,
        O.map(({ fees, rates }) => {
          const feeAmount = fees[selectedFeeOptionKey]
          const feeRate = rates[selectedFeeOptionKey]
          const roundedFeeRate = Math.ceil(feeRate)
          setFeeRate(roundedFeeRate)
          setAssetFee(new CryptoAmount(feeAmount, asset))
          return feeAmount
        })
      )
    }
    if (isCOSMOSChain) {
      return oFee
    }
    return O.none
  }, [
    isEVMChain,
    isUTXOChain,
    isCOSMOSChain,
    oFees,
    oFeesWithRates,
    oFee,
    selectedFeeOption,
    selectedFeeOptionKey,
    asset
  ])

  const oAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    if (isEVMChain) {
      const isChainAsset = isEvmChainAsset(asset)
      if (isChainAsset) return O.some(balance.amount)
      // For EVM tokens, get ETH balance for fees
      return FP.pipe(
        balances,
        (bals) => bals.find((b) => b.asset.chain === asset.chain && isEvmChainAsset(b.asset)),
        O.fromNullable,
        O.map((b) => b.amount)
      )
    }
    if (isUTXOChain || isCOSMOSChain) {
      return O.some(balance.amount)
    }
    return O.none
  }, [isEVMChain, isUTXOChain, isCOSMOSChain, asset, balance.amount, balances])

  const maxAmount: BaseAmount = useMemo(() => {
    if (isEVMChain) {
      const maxEthAmount: BigNumber = FP.pipe(
        sequenceTOption(selectedFee, oAssetAmount),
        O.fold(
          () => ZERO_BN,
          ([fee, assetAmount]) => {
            const max = assetAmount.amount().minus(fee.amount())
            return max.isGreaterThan(0) ? max : ZERO_BN
          }
        )
      )
      const isChainAsset = isEvmChainAsset(asset)
      return isChainAsset ? baseAmount(maxEthAmount, balance.amount.decimal) : balance.amount
    }
    if (isUTXOChain) {
      return FP.pipe(
        selectedFee,
        O.map((fee) => {
          const utxoSafetyBuffer = baseAmount(10000, balance.amount.decimal)
          const max = balance.amount.minus(fee).minus(utxoSafetyBuffer)
          const zero = baseAmount(0, max.decimal)
          return max.gt(zero) ? max : zero
        }),
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      )
    }
    if (isCOSMOSChain) {
      const accountReserve = asset.chain === 'XRP' ? baseAmount(1000000, balance.amount.decimal) : ZERO_BASE_AMOUNT
      const isChainAsset = eqAsset(asset, sourceChainAsset)
      return FP.pipe(
        sequenceTOption(selectedFee, oAssetAmount),
        O.fold(
          () => {
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
    }
    return ZERO_BASE_AMOUNT
  }, [isEVMChain, isUTXOChain, isCOSMOSChain, selectedFee, oAssetAmount, balance.amount, asset, sourceChainAsset])

  const isFeeError = useMemo(() => {
    return FP.pipe(
      sequenceTOption(selectedFee, oAssetAmount),
      O.fold(
        () => false,
        ([fee, assetAmount]) => assetAmount.lt(fee)
      )
    )
  }, [selectedFee, oAssetAmount])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const amount: BaseAmount = FP.pipe(
      oAssetAmount,
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const msg = intl.formatMessage(
      { id: 'wallet.errors.fee.notCovered' },
      {
        balance: formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset: isEVMChain ? getChainAsset(asset.chain) : asset,
          trimZeros: true
        })
      }
    )

    return (
      <Styled.Label size="big" color="error">
        {msg}
      </Styled.Label>
    )
  }, [isFeeError, oAssetAmount, intl, isEVMChain, asset])

  useEffect(() => {
    const amountValue = isEVMChain
      ? O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)
      : (amountToSend as BaseAmount)

    const isPoolDetails = (poolDetails: PoolDetails | PoolDetailsMaya): poolDetails is PoolDetails => {
      return (poolDetails as PoolDetails) !== undefined
    }

    const maxAmountPrice =
      isPoolDetails(poolDetails) && isChainOfThor(asset.chain)
        ? getPoolPriceValue({
            balance: { asset, amount: maxAmount },
            poolDetails,
            pricePool
          })
        : getPoolPriceValueM({
            balance: { asset, amount: maxAmount },
            poolDetails,
            pricePool: pricePoolMaya,
            mayaPriceRD: mayaScanPrice
          })

    const amountPrice =
      isPoolDetails(poolDetails) && isChainOfThor(asset.chain)
        ? getPoolPriceValue({
            balance: { asset, amount: amountValue },
            poolDetails,
            pricePool
          })
        : getPoolPriceValueM({
            balance: { asset, amount: amountValue },
            poolDetails,
            pricePool: pricePoolMaya,
            mayaPriceRD: mayaScanPrice
          })

    const assetFeePrice =
      isPoolDetails(poolDetails) && isChainOfThor(sourceChainAsset.chain)
        ? getPoolPriceValue({
            balance: { asset: sourceChainAsset, amount: assetFee.baseAmount },
            poolDetails,
            pricePool
          })
        : getPoolPriceValueM({
            balance: { asset: sourceChainAsset, amount: assetFee.baseAmount },
            poolDetails,
            pricePool: pricePoolMaya,
            mayaPriceRD: mayaScanPrice
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
  }, [
    amountToSend,
    asset,
    maxAmount,
    assetFee,
    pricePool.asset,
    pricePool,
    network,
    poolDetails,
    sourceChainAsset,
    pricePoolMaya,
    mayaScanPrice,
    isEVMChain
  ])

  // Watch the recipient field for changes
  const recipientValue = watch('recipient')

  // Effect to check XRP destination tag requirements
  useEffect(() => {
    let active = true

    if (!isXrpChain) {
      setDestinationTagRequired(false)
      return
    }

    if (!recipientValue) {
      setDestinationTagRequired(false)
      return
    }

    const subscription = xrpContext.client$.subscribe(async (oClient) => {
      if (O.isSome(oClient)) {
        try {
          const requiresDestTag = await oClient.value.requiresDestinationTag(recipientValue)
          if (active) {
            setDestinationTagRequired(requiresDestTag)
          }
        } catch (error) {
          if (active) {
            setDestinationTagRequired(false)
          }
        }
      } else {
        setDestinationTagRequired(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [isXrpChain, recipientValue, xrpContext.client$, setDestinationTagRequired])

  const addressValidator = useCallback(
    async (value: string) => {
      if (!value) {
        setWarningMessage('')
        return intl.formatMessage({ id: 'wallet.errors.address.empty' })
      }

      if (isEVMChain) {
        if (!validateAddress(value.toLowerCase())) {
          return intl.formatMessage({ id: 'wallet.errors.address.invalid' })
        }
      } else {
        try {
          if (!addressValidation(value)) {
            return intl.formatMessage({ id: 'wallet.errors.address.invalid' })
          }
        } catch (error) {
          return intl.formatMessage({ id: 'wallet.errors.address.invalid' })
        }
      }

      const inboundAddress = {
        THOR: FP.pipe(
          oPoolAddress,
          O.map((details) => details.address),
          O.getOrElse(() => '')
        ),
        MAYA: FP.pipe(
          oPoolAddressMaya || O.none,
          O.map((details) => details.address),
          O.getOrElse(() => '')
        )
      }

      const routerAddress = {
        THOR: FP.pipe(
          oPoolAddress,
          O.chain((details) => details.router),
          O.getOrElse(() => '')
        ),
        MAYA: FP.pipe(
          oPoolAddressMaya || O.none,
          O.chain((details) => details.router),
          O.getOrElse(() => '')
        )
      }

      // Check for inbound addresses
      if (inboundAddress.THOR === value || inboundAddress.MAYA === value) {
        const dexInbound = inboundAddress.THOR === value ? 'Thorchain' : 'Mayachain'
        const type = `${dexInbound} ${asset.chain} Inbound`
        setWarningMessage(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type: type }))
        setIsRouterAddress(false)
      }
      // Check for router addresses
      else if (routerAddress.THOR === value || routerAddress.MAYA === value) {
        const dexRouter = routerAddress.THOR === value ? 'Thorchain' : 'Mayachain'
        const type = `${dexRouter} ${asset.chain} Router`
        setWarningMessage(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type: type }))
        setIsRouterAddress(true)
      } else {
        setWarningMessage('')
        setIsRouterAddress(false)
      }

      // For XRP, destination tag validation will be handled separately

      return true
    },
    [isEVMChain, addressValidation, intl, oPoolAddress, oPoolAddressMaya, asset.chain]
  )

  const amountValidator = useCallback(
    async (value: BigNumber) => {
      const errors = {
        msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
        msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
        msg3: isEVMChain
          ? intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
          : intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
      }

      try {
        await validateTxAmountInput({ input: value, maxAmount: baseToAsset(maxAmount), errors })
        return true
      } catch (error) {
        return error as string
      }
    },
    [intl, maxAmount, isEVMChain]
  )

  const handleMemo = useCallback(
    (e?: React.ChangeEvent<HTMLInputElement>) => {
      const memoValue = e ? e.target.value : (watch('memo') as string)
      setValue('memo', memoValue)
      setCurrentMemo(memoValue)
    },
    [setValue, watch]
  )

  const handleSavedAddressSelect = useCallback(
    (value: string) => {
      setValue('recipient', value)
      if (isEVMChain) {
        setRecipientAddress(O.fromNullable(value))
      } else {
        setRecipientAddress(value)
      }
      const matched = Shared.filterMatchedAddresses(oSavedAddresses, value)
      setMatchedAddresses(matched)
    },
    [setValue, isEVMChain, oSavedAddresses]
  )

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      const validationResult = await amountValidator(value)
      if (validationResult === true) {
        const newAmount = assetToBase(assetAmount(value, balance.amount.decimal))
        if (isEVMChain) {
          setAmountToSend(O.some(newAmount))
        } else {
          setAmountToSend(newAmount)
        }
      } else {
        if (isEVMChain) {
          setAmountToSend(O.none)
        }
      }
    },
    [amountValidator, balance.amount.decimal, isEVMChain]
  )

  const onChangeAddress = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (isEVMChain) {
        setRecipientAddress(O.fromNullable(value))
      } else {
        setRecipientAddress(value)
      }
      const matched = Shared.filterMatchedAddresses(oSavedAddresses, value)
      setMatchedAddresses(matched)
    },
    [isEVMChain, oSavedAddresses]
  )

  const addMaxAmountHandler = useCallback(() => {
    if (isEVMChain) {
      setAmountToSend(O.some(maxAmount))
    } else {
      setAmountToSend(maxAmount)
    }
    setValue('amount', baseToAsset(maxAmount).amount())
  }, [isEVMChain, maxAmount, setValue])

  const feeOptionsLabel: Record<FeeOption, string> = useMemo(
    () => ({
      [FeeOption.Fast]: intl.formatMessage({ id: 'wallet.send.fast' }),
      [FeeOption.Fastest]: intl.formatMessage({ id: 'wallet.send.fastest' }),
      [FeeOption.Average]: intl.formatMessage({ id: 'wallet.send.average' })
    }),
    [intl]
  )

  const renderFeeOptions = useMemo(() => {
    if (!isEVMChain && !isUTXOChain) return null

    const onChangeHandler = (e: string) => {
      if (isEVMChain) {
        setSelectedFeeOption(e as FeeOption)
      } else {
        setSelectedFeeOptionKey(e as FeeOption)
      }
    }

    const disabled = isLoading

    return (
      <RadioGroup
        className="flex flex-col lg:flex-row lg:space-x-2"
        onChange={onChangeHandler}
        value={isEVMChain ? selectedFeeOption : selectedFeeOptionKey}
        disabled={disabled}>
        <Radio value="average" key="average">
          <Label disabled={disabled} textTransform="uppercase">
            {feeOptionsLabel['average']}
          </Label>
        </Radio>
        <Radio value="fast" key="fast">
          <Label disabled={disabled} textTransform="uppercase">
            {feeOptionsLabel['fast']}
          </Label>
        </Radio>
        <Radio value="fastest" key="fastest">
          <Label disabled={disabled} textTransform="uppercase">
            {feeOptionsLabel['fastest']}
          </Label>
        </Radio>
      </RadioGroup>
    )
  }, [isEVMChain, isUTXOChain, isLoading, selectedFeeOption, selectedFeeOptionKey, feeOptionsLabel])

  const renderSlider = useMemo(() => {
    const amountValue = isEVMChain
      ? O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)
      : (amountToSend as BaseAmount)

    const maxAmountValue = maxAmount.amount()
    const percentage = maxAmountValue.isZero()
      ? 0
      : amountValue
          .amount()
          .dividedBy(maxAmountValue)
          .multipliedBy(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN)
          .toNumber()

    const setAmountToSendFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmount.amount().multipliedBy(percents / 100)
      const newAmount = baseAmount(amountFromPercentage, maxAmount.decimal)

      if (isEVMChain) {
        setAmountToSend(O.some(newAmount))
      } else {
        setAmountToSend(newAmount)
      }
      setValue('amount', baseToAsset(newAmount).amount())
    }

    return (
      <Slider
        key={'Send percentage slider'}
        value={percentage}
        onChange={setAmountToSendFromPercentValue}
        disabled={isLoading}
      />
    )
  }, [amountToSend, maxAmount, isLoading, isEVMChain, setValue])

  const priceFeeLabel = useMemo(() => {
    if (!feePriceValue) {
      return loadingString
    }

    const isFeeVerySmallUSDAmount = isUSDAsset(assetFee.asset) && assetFee.assetAmount.amount().lt(0.01)
    const feeDecimalPlaces = isUSDAsset(assetFee.asset) ? (isFeeVerySmallUSDAmount ? 6 : 2) : 6
    const fee = formatAssetAmountCurrency({
      amount: assetFee.assetAmount,
      asset: assetFee.asset,
      decimal: feeDecimalPlaces,
      trimZeros: !isUSDAsset(assetFee.asset)
    })

    const price = FP.pipe(
      O.some(feePriceValue),
      O.map((cryptoAmount: CryptoAmount) =>
        eqAsset(asset, cryptoAmount.asset)
          ? ''
          : (() => {
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
    const amountValue = isEVMChain
      ? O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)
      : (amountToSend as BaseAmount)

    if (!amountValue || amountValue.amount().isZero()) {
      return loadingString
    }

    const assetAmount = baseToAsset(amountValue)
    const isVerySmallUSDAmount = isUSDAsset(asset) && assetAmount.amount().lt(0.01)
    const decimalPlaces = isUSDAsset(asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6
    const amount = formatAssetAmountCurrency({
      amount: assetAmount,
      asset: asset,
      decimal: decimalPlaces,
      trimZeros: !isUSDAsset(asset)
    })

    const price = isMayaAsset(asset)
      ? RD.isSuccess(amountToSendMayaPrice)
        ? (() => {
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
          O.some(amountPriceValue),
          O.map((cryptoAmount: CryptoAmount) =>
            eqAsset(asset, cryptoAmount.asset)
              ? ''
              : (() => {
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
  }, [amountPriceValue, amountToSend, amountToSendMayaPrice, asset, isEVMChain])

  const submitDepositTx = useCallback(() => {
    if (!isEVMChain || !deposit$) return

    const amount = O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)

    FP.pipe(
      oProtocol,
      O.chain((protocol) => {
        const selectedOPool = protocol === THORChain ? oPoolAddress : oPoolAddressMaya || O.none
        return sequenceTOption(O.some(amount), selectedOPool, O.some(protocol))
      }),
      O.map(([amount, poolAddress, protocol]) => {
        subscribeDepositState(
          deposit$({
            walletType,
            walletAccount,
            walletIndex,
            hdMode,
            sender: walletAddress,
            poolAddress,
            asset,
            amount,
            memo: currentMemo,
            protocol: protocol
          })
        )
        return true
      })
    )
  }, [
    isEVMChain,
    deposit$,
    amountToSend,
    oPoolAddress,
    oPoolAddressMaya,
    oProtocol,
    subscribeDepositState,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletAddress,
    asset,
    currentMemo
  ])

  // Transaction submission
  const submitTx = useCallback(() => {
    const amount = isEVMChain
      ? O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)
      : (amountToSend as BaseAmount)

    const recipient = isEVMChain
      ? O.getOrElse(() => '')(recipientAddress as O.Option<Address>)
      : (recipientAddress as Address)

    subscribeSendTxState(
      transfer$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        sender: walletAddress,
        recipient,
        asset,
        amount,
        feeOption: isEVMChain ? selectedFeeOption : selectedFeeOptionKey,
        memo: currentMemo,
        destinationTag: watch('destinationTag')
      })
    )
  }, [
    isEVMChain,
    amountToSend,
    recipientAddress,
    subscribeSendTxState,
    transfer$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletAddress,
    asset,
    selectedFeeOption,
    selectedFeeOptionKey,
    currentMemo,
    watch
  ])

  // Confirmation modal
  const renderConfirmationModal = useMemo(() => {
    const onSuccessHandler = () => {
      setShowConfirmationModal(false)
      poolDeposit ? submitDepositTx() : submitTx()
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
          addresses={O.some({ sender: walletAddress, recipient: watch('recipient') })}
        />
      )
    }
    return null
  }, [
    walletType,
    poolDeposit,
    submitDepositTx,
    submitTx,
    validatePassword$,
    network,
    showConfirmationModal,
    asset.chain,
    intl,
    walletAddress,
    watch
  ])

  // Transaction modal
  const renderTxModal = useMemo(() => {
    const amount = isEVMChain
      ? O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)
      : (amountToSend as BaseAmount)

    if (isEVMChain && poolDeposit) {
      return FP.pipe(
        O.some(amount),
        O.fold(
          () => <></>,
          (amount) =>
            Shared.renderDepositModal({
              asset,
              amountToSend: amount,
              network,
              depositState,
              resetDepositState,
              sendTxStartTime: Date.now(),
              openExplorerTxUrl,
              getExplorerTxUrl,
              intl
            })
        )
      )
    }

    return Shared.renderTxModal({
      asset,
      amountToSend: amount,
      network,
      sendTxState,
      resetSendTxState,
      sendTxStartTime: Date.now(),
      openExplorerTxUrl,
      getExplorerTxUrl,
      intl
    })
  }, [
    isEVMChain,
    poolDeposit,
    amountToSend,
    asset,
    network,
    depositState,
    resetDepositState,
    sendTxState,
    resetSendTxState,
    openExplorerTxUrl,
    getExplorerTxUrl,
    intl
  ])

  // UI Fees
  const uiFeesRD: UIFeesRD = useMemo(() => {
    if (isEVMChain && feesRD) {
      return FP.pipe(
        feesRD,
        RD.map((fees) => [{ asset: getChainAsset(asset.chain), amount: fees[selectedFeeOption] }]),
        RD.mapLeft((error) => new Error(`${error.message.split(':')[0]}`))
      )
    }
    if (isUTXOChain && feesWithRatesRD) {
      return FP.pipe(
        feesWithRatesRD,
        RD.map((feesWithRates) => [{ asset: asset, amount: feesWithRates.fees[selectedFeeOptionKey] }])
      )
    }
    if (isCOSMOSChain && feeRD) {
      return FP.pipe(
        feeRD,
        RD.map((fee) => {
          setAssetFee(new CryptoAmount(fee, sourceChainAsset))
          return [{ asset: sourceChainAsset, amount: fee }]
        })
      )
    }
    return RD.initial
  }, [
    isEVMChain,
    isUTXOChain,
    isCOSMOSChain,
    feesRD,
    feesWithRatesRD,
    feeRD,
    asset,
    selectedFeeOption,
    selectedFeeOptionKey,
    sourceChainAsset
  ])

  // Wallet type detection
  const oMatchedWalletType: O.Option<WalletType> = useMemo(() => {
    const recipientAddressValue = isEVMChain
      ? O.getOrElse(() => '')(recipientAddress as O.Option<Address>)
      : (recipientAddress as Address)
    return matchedWalletType(balances, recipientAddressValue)
  }, [balances, recipientAddress, isEVMChain])

  const renderWalletType = useMemo(
    () => renderedWalletType(oMatchedWalletType, matchedAddresses),
    [matchedAddresses, oMatchedWalletType]
  )

  // Saved addresses dropdown
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

  // Memo field rendering (only for certain chains)
  const renderMemo = () => {
    // Hide memo field for XRP when destination tag is required to avoid confusion
    if (isXrpChain && destinationTagRequired) return null
    // Show memo field for UTXO, COSMOS chains, or EVM chains
    if (isUTXOChain || isCOSMOSChain || isEVMChain) {
      return (
        <>
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
        </>
      )
    }
    return null
  }

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

            {/* Destination Tag field for XRP - show for all XRP transfers */}
            {isXrpChain && (
              <>
                <Styled.CustomLabel className="mt-2" size="big">
                  {intl.formatMessage({ id: 'common.destinationTag' })}
                  {destinationTagRequired && <span className="text-error0 dark:text-error0d"> *</span>}
                </Styled.CustomLabel>
                <div className="flex flex-col">
                  <Controller
                    name="destinationTag"
                    control={control}
                    rules={{
                      required: destinationTagRequired
                        ? intl.formatMessage({ id: 'wallet.errors.destinationTag.required' })
                        : false,
                      validate: (value) => {
                        // If destination tag is required and not provided
                        if (destinationTagRequired && (value === undefined || value === null)) {
                          return intl.formatMessage({ id: 'wallet.errors.destinationTag.required' })
                        }

                        // If value is provided, validate the format
                        if (value !== undefined && value !== null) {
                          const numValue = typeof value === 'string' ? parseInt(value, 10) : value
                          if (!Number.isInteger(numValue) || numValue < 0 || numValue > 4294967295) {
                            return intl.formatMessage({ id: 'wallet.errors.destinationTag.invalid' })
                          }
                        }
                        return true
                      }
                    }}
                    render={({ field }) => (
                      <Input
                        size="large"
                        disabled={isLoading}
                        value={field.value?.toString() || ''}
                        onChange={(e) => {
                          const value = e.target.value.trim()
                          field.onChange(value ? parseInt(value, 10) : undefined)
                        }}
                        placeholder={
                          destinationTagRequired
                            ? intl.formatMessage({ id: 'common.destinationTag.required.placeholder' })
                            : intl.formatMessage({ id: 'common.destinationTag.placeholder' })
                        }
                        type="number"
                        error={!!errors.destinationTag}
                      />
                    )}
                  />
                  {errors.destinationTag && (
                    <span className="text-error0 dark:text-error0d text-xs mt-1">
                      {typeof errors.destinationTag === 'string'
                        ? errors.destinationTag
                        : errors.destinationTag.message}
                    </span>
                  )}
                </div>
              </>
            )}

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
                    error={!!errors.amount}
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
              disabled={isLoading}
            />

            <div className="w-full py-2">{renderSlider}</div>

            <Styled.Fees
              fees={uiFeesRD}
              reloadFees={
                typeof reloadFeesHandler === 'function' && reloadFeesHandler.length === 0
                  ? (reloadFeesHandler as () => void)
                  : undefined
              }
              disabled={isLoading}
            />

            {renderFeeError}

            {/* Fee options for EVM and UTXO chains */}
            {(isEVMChain || isUTXOChain) && (
              <div className="flex flex-col">
                <Controller
                  name={isEVMChain ? 'fee' : 'feeRate'}
                  control={control}
                  render={({ field }) => <div onChange={(e) => field.onChange(e)}>{renderFeeOptions}</div>}
                />
              </div>
            )}

            {/* Advanced Settings for EVM chains */}
            {isEVMChain && isEvmChainAsset(asset) && (
              <div className="mt-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <Styled.SwitchWrapper>
                  <SwitchButton disabled={false} onChange={() => setPoolDeposit(!poolDeposit)} active={poolDeposit} />
                  {poolDeposit ? (
                    <Styled.Alert>
                      <span className="text-red-600 dark:text-red-400 font-semibold">
                        <FormattedMessage
                          id="deposit.poolTransactionWarning"
                          defaultMessage="Send pool transaction on {protocol}. Dev use only or risk losing your funds"
                          values={{
                            protocol: FP.pipe(
                              oProtocol,
                              O.getOrElse(() => 'an unknown protocol')
                            )
                          }}
                        />
                      </span>
                    </Styled.Alert>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-300">
                      <FormattedMessage
                        id="deposit.transferToken"
                        defaultMessage="Transfer token {ticker}"
                        values={{ ticker: asset.ticker }}
                      />
                    </span>
                  )}
                </Styled.SwitchWrapper>
                {<Styled.MemoWrapper>{renderMemo()}</Styled.MemoWrapper>}
              </div>
            )}

            {/* Memo field for UTXO, COSMOS chains, and EVM tokens (non-chain assets) */}
            {(!isEVMChain || (isEVMChain && !isEvmChainAsset(asset))) && renderMemo()}
          </Styled.SubForm>

          <FlatButton
            className="mt-40px min-w-[200px] w-full"
            loading={isLoading}
            disabled={isFeeError || isLoading || isRouterAddress}
            type="submit"
            size="large">
            {poolDeposit
              ? intl.formatMessage({ id: 'wallet.action.deposit' })
              : intl.formatMessage({ id: 'wallet.action.send' })}
          </FlatButton>
        </form>

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
                recipient={
                  isEVMChain
                    ? O.getOrElse(() => '')(recipientAddress as O.Option<Address>)
                    : (recipientAddress as Address)
                }
                amountLabel={amountLabel}
                priceFeeLabel={priceFeeLabel}
                currentMemo={currentMemo}
                asset={asset}
                upperFeeBound={isUTXOChain ? getChainFeeBounds(asset.chain) : undefined}
                feeRate={isUTXOChain ? feeRate : undefined}
                destinationTag={isXrpChain ? watch('destinationTag') : undefined}
              />
            )}
          </div>
        </div>
      </Styled.Container>

      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
