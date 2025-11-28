import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { FeeOption, Fees, FeesWithRates, Network } from '@xchainjs/xchain-client'
import { validateAddress } from '@xchainjs/xchain-evm'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  assetAmount,
  assetToBase,
  AssetType,
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
import * as PoolHelpers from '../../../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../../../helpers/poolHelperMaya'
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
import { PoolDetails as PoolDetailsMaya } from '../../../../services/midgard/mayaMidgard/types'
import { PoolAddress, PoolDetails } from '../../../../services/midgard/midgardTypes'
import { FeesWithRatesRD } from '../../../../services/utxo/types'
import { SelectedWalletAsset, ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { SwitchButton } from '../../../uielements/button/SwitchButton'
import { Fees as UIFees, UIFeesRD } from '../../../uielements/fees'
import { Input, InputBigNumber } from '../../../uielements/input'
import { Label } from '../../../uielements/label'
import { RadioGroup, Radio } from '../../../uielements/radio'
import { ShowDetails } from '../../../uielements/showDetails'
import { Slider } from '../../../uielements/slider'
import { AccountSelector } from '../../account'
import { matchedWalletType, renderedWalletType } from '../TxForm.helpers'
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

  // Determine the effective chain for operations (MAYAChain for synths, THORChain for secured, otherwise asset.chain)
  const effectiveChain = (
    asset.type === AssetType.SYNTH ? MAYAChain : asset.type === AssetType.SECURED ? THORChain : asset.chain
  ) as Chain

  const sourceChainAsset = getChainAsset(effectiveChain)

  // Get XRP client for destination tag validation
  const xrpContext = useXrpContext()
  const isXrpChain = effectiveChain === XRPChain

  // Chain type detection using effective chain
  const isEVMChain = isEvmChain(effectiveChain)
  const isUTXOChain = isUtxoAssetChain({ ...asset, chain: effectiveChain })
  const isCOSMOSChain = !isEVMChain && !isUTXOChain

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = useMemo(
    () => (!isChainOfMaya(effectiveChain) ? pricePoolThor : pricePoolMaya),
    [effectiveChain, pricePoolThor, pricePoolMaya]
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
      FP.pipe(
        O.fromNullable(trustedAddresses?.addresses),
        O.map(A.filter((address) => address.chain === effectiveChain))
      ),
    [trustedAddresses?.addresses, effectiveChain]
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
          setAssetFee(new CryptoAmount(fees[selectedFeeOption], getChainAsset(effectiveChain)))
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
    asset,
    effectiveChain
  ])

  const oAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    if (isEVMChain) {
      const isChainAsset = isEvmChainAsset(asset)
      if (isChainAsset) return O.some(balance.amount)
      // For EVM tokens, get ETH balance for fees
      return FP.pipe(
        balances,
        (bals) => bals.find((b) => b.asset.chain === effectiveChain && isEvmChainAsset(b.asset)),
        O.fromNullable,
        O.map((b) => b.amount)
      )
    }
    if (isUTXOChain || isCOSMOSChain) {
      return O.some(balance.amount)
    }
    return O.none
  }, [isEVMChain, isUTXOChain, isCOSMOSChain, asset, balance.amount, balances, effectiveChain])

  // Separate balance for fee validation - chain asset uses its own balance, tokens/synths use chain asset balance
  const oFeeAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    const chainAsset = getChainAsset(effectiveChain)
    const isChainAsset = eqAsset(asset, chainAsset)

    if (isChainAsset) {
      // Chain asset uses its own balance
      return O.some(balance.amount)
    } else {
      // Token/synth uses chain asset balance
      return FP.pipe(
        balances,
        (bals) => bals.find((b) => eqAsset(b.asset, chainAsset)),
        O.fromNullable,
        O.map((b) => b.amount)
      )
    }
  }, [asset, balance.amount, balances, effectiveChain])

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
      const accountReserve =
        effectiveChain === XRPChain ? baseAmount(1000000, balance.amount.decimal) : ZERO_BASE_AMOUNT
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
  }, [
    isEVMChain,
    isUTXOChain,
    isCOSMOSChain,
    selectedFee,
    oAssetAmount,
    balance.amount,
    asset,
    sourceChainAsset,
    effectiveChain
  ])

  const isFeeError = useMemo(() => {
    return FP.pipe(
      sequenceTOption(selectedFee, oFeeAssetAmount),
      O.fold(
        () => false,
        ([fee, assetAmount]) => assetAmount.lt(fee)
      )
    )
  }, [selectedFee, oFeeAssetAmount])

  const renderFeeError = useMemo(() => {
    if (!isFeeError) return <></>

    const amount: BaseAmount = FP.pipe(
      oFeeAssetAmount,
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const msg = intl.formatMessage(
      { id: 'wallet.errors.fee.notCovered' },
      {
        balance: formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset: eqAsset(asset, getChainAsset(effectiveChain)) ? asset : getChainAsset(effectiveChain),
          trimZeros: true
        })
      }
    )

    return (
      <Label className="mb-3.5" size="big" color="error" textTransform="uppercase">
        {msg}
      </Label>
    )
  }, [isFeeError, oFeeAssetAmount, intl, asset, effectiveChain])

  useEffect(() => {
    const amountValue = isEVMChain
      ? O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend as O.Option<BaseAmount>)
      : (amountToSend as BaseAmount)

    const maxAmountPrice = isChainOfThor(effectiveChain)
      ? PoolHelpers.getUSDValue({
          balance: { asset, amount: maxAmount },
          poolDetails: poolDetails as PoolDetails,
          pricePool
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset, amount: maxAmount },
          poolDetails: poolDetails as PoolDetailsMaya,
          pricePool: pricePoolMaya
        })

    const amountPrice = isChainOfThor(effectiveChain)
      ? PoolHelpers.getUSDValue({
          balance: { asset, amount: amountValue },
          poolDetails: poolDetails as PoolDetails,
          pricePool
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset, amount: amountValue },
          poolDetails: poolDetails as PoolDetailsMaya,
          pricePool: pricePoolMaya
        })

    const assetFeePrice = isChainOfThor(sourceChainAsset.chain)
      ? PoolHelpers.getUSDValue({
          balance: { asset: sourceChainAsset, amount: assetFee.baseAmount },
          poolDetails: poolDetails as PoolDetails,
          pricePool
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset: sourceChainAsset, amount: assetFee.baseAmount },
          poolDetails: poolDetails as PoolDetailsMaya,
          pricePool: pricePoolMaya
        })

    if (O.isSome(assetFeePrice)) {
      const maxCryptoAmount = new CryptoAmount(assetFeePrice.value, pricePool.asset)
      setFeePriceValue((prev) => {
        if (
          !prev.assetAmount.amount().eq(maxCryptoAmount.assetAmount.amount()) ||
          !eqAsset(prev.asset, maxCryptoAmount.asset)
        ) {
          return maxCryptoAmount
        }
        return prev
      })
    }
    if (O.isSome(amountPrice)) {
      const amountPriceAmount = new CryptoAmount(amountPrice.value, pricePool.asset)
      setAmountPriceValue((prev) => {
        if (
          !prev.baseAmount.amount().eq(amountPriceAmount.baseAmount.amount()) ||
          !eqAsset(prev.asset, amountPriceAmount.asset)
        ) {
          return amountPriceAmount
        }
        return prev
      })
    }
    if (O.isSome(maxAmountPrice)) {
      const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
      setMaxAmountPriceValue((prev) => {
        if (
          !prev.baseAmount.amount().eq(maxCryptoAmount.baseAmount.amount()) ||
          !eqAsset(prev.asset, maxCryptoAmount.asset)
        ) {
          return maxCryptoAmount
        }
        return prev
      })
    }
  }, [
    amountToSend,
    asset,
    maxAmount,
    assetFee,
    pricePool,
    network,
    poolDetails,
    sourceChainAsset,
    pricePoolMaya,
    isEVMChain,
    effectiveChain
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
    [isEVMChain, oPoolAddress, oPoolAddressMaya, intl, addressValidation, asset.chain]
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
      const newValue = validationResult === true ? assetToBase(assetAmount(value, balance.amount.decimal)) : null

      setAmountToSend((prev) => {
        if (isEVMChain) {
          const prevAmount = O.getOrElse(() => ZERO_BASE_AMOUNT)(prev as O.Option<BaseAmount>)
          if (newValue) {
            if (!prevAmount.amount().eq(newValue.amount()) || prevAmount.decimal !== newValue.decimal) {
              return O.some(newValue)
            }
          } else if (O.isSome(prev as O.Option<BaseAmount>)) {
            return O.none
          }
          return prev
        } else {
          const prevAmount = prev as BaseAmount
          const targetAmount = newValue || ZERO_BASE_AMOUNT
          if (!prevAmount.amount().eq(targetAmount.amount()) || prevAmount.decimal !== targetAmount.decimal) {
            return targetAmount
          }
          return prev
        }
      })
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
      setAmountToSend((prev) => {
        const prevAmount = O.getOrElse(() => ZERO_BASE_AMOUNT)(prev as O.Option<BaseAmount>)
        if (!prevAmount.amount().eq(maxAmount.amount()) || prevAmount.decimal !== maxAmount.decimal) {
          return O.some(maxAmount)
        }
        return prev
      })
    } else {
      setAmountToSend((prev) => {
        const prevAmount = prev as BaseAmount
        if (!prevAmount.amount().eq(maxAmount.amount()) || prevAmount.decimal !== maxAmount.decimal) {
          return maxAmount
        }
        return prev
      })
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
        setAmountToSend((prev) => {
          const prevAmount = O.getOrElse(() => ZERO_BASE_AMOUNT)(prev as O.Option<BaseAmount>)
          if (!prevAmount.amount().eq(newAmount.amount()) || prevAmount.decimal !== newAmount.decimal) {
            return O.some(newAmount)
          }
          return prev
        })
      } else {
        setAmountToSend((prev) => {
          const prevAmount = prev as BaseAmount
          if (!prevAmount.amount().eq(newAmount.amount()) || prevAmount.decimal !== newAmount.decimal) {
            return newAmount
          }
          return prev
        })
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
        RD.map((fees) => [{ asset: getChainAsset(effectiveChain), amount: fees[selectedFeeOption] }]),
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
    sourceChainAsset,
    effectiveChain
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
              <Label size="big" color="gray" textTransform="uppercase">
                {intl.formatMessage({ id: 'common.savedAddresses' })}
              </Label>
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
          <Label size="big" color="gray" textTransform="uppercase">
            {intl.formatMessage({ id: 'common.memo' })}
          </Label>
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
      <div className="flex min-h-full w-full max-w-[630px] flex-col p-2.5 sm:p-[35px_50px_150px]">
        <AccountSelector selectedWallet={balance} network={network} />
        <form onSubmit={handleSubmit(() => setShowConfirmationModal(true))}>
          <div className="max-w-[630px]">
            {renderSavedAddressesDropdown}
            <Label className="mt-2 flex items-center" size="big" color="gray" textTransform="uppercase">
              {intl.formatMessage({ id: 'common.address' })}
              {renderWalletType}
            </Label>
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
                <span className="mt-1 text-xs text-error0 dark:text-error0d">
                  {typeof errors.recipient === 'string' ? errors.recipient : errors.recipient.message}
                </span>
              )}
            </div>
            {warningMessage && <div className="pb-20px text-warning0 dark:text-warning0d">{warningMessage}</div>}

            {/* Destination Tag field for XRP - show for all XRP transfers */}
            {isXrpChain && (
              <>
                <Label className="mt-2 flex items-center" size="big" color="gray" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.destinationTag' })}
                  {destinationTagRequired && <span className="text-error0 dark:text-error0d"> *</span>}
                </Label>
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
                    <span className="mt-1 text-xs text-error0 dark:text-error0d">
                      {typeof errors.destinationTag === 'string'
                        ? errors.destinationTag
                        : errors.destinationTag.message}
                    </span>
                  )}
                </div>
              </>
            )}

            <Label size="big" className="mt-2" textTransform="uppercase" color="gray">
              {intl.formatMessage({ id: 'common.amount' })}
            </Label>
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
                <span className="mt-1 text-xs text-error0 dark:text-error0d">{errors.amount.message}</span>
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

            <UIFees
              className="p-0 pb-5"
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
                <div className="flex flex-wrap items-center gap-4 py-2.5">
                  <SwitchButton disabled={false} onChange={() => setPoolDeposit(!poolDeposit)} active={poolDeposit} />
                  {poolDeposit ? (
                    <div className="flex max-w-full flex-1 items-center rounded-lg border border-error0/[0.25] bg-error0/[0.13] px-3 py-2 sm:max-w-[500px]">
                      <span className="text-sm leading-[1.4] text-error0 dark:text-error0d">
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
                    </div>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-300">
                      <FormattedMessage
                        id="deposit.transferToken"
                        defaultMessage="Transfer token {ticker}"
                        values={{ ticker: asset.ticker }}
                      />
                    </span>
                  )}
                </div>
                <div className="mt-4">{renderMemo()}</div>
              </div>
            )}

            {/* Memo field for UTXO, COSMOS chains, and EVM tokens (non-chain assets) */}
            {(!isEVMChain || (isEVMChain && !isEvmChainAsset(asset))) && renderMemo()}
          </div>

          <FlatButton
            className="mt-40px w-full min-w-[200px]"
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
                <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
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
      </div>

      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
