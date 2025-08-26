import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { FeeOption, Fees, Network } from '@xchainjs/xchain-client'
import { validateAddress } from '@xchainjs/xchain-evm'
import { MayaChain } from '@xchainjs/xchain-mayachain-query'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  bn,
  baseToAsset,
  BaseAmount,
  assetToBase,
  assetAmount,
  Address,
  formatAssetAmountCurrency,
  baseAmount,
  eqAsset,
  CryptoAmount,
  Chain
} from '@xchainjs/xchain-util'
import { Form } from 'antd'
import BigNumber from 'bignumber.js'
import { array as A, function as FP, option as O } from 'fp-ts'
import { FormattedMessage, useIntl } from 'react-intl'

import { TrustedAddress, TrustedAddresses } from '../../../../../shared/api/types'
import { chainToString, isChainOfMaya, isChainOfThor } from '../../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT, ZERO_BN } from '../../../../const'
import { isUSDAsset } from '../../../../helpers/assetHelper'
import { getChainAsset } from '../../../../helpers/chainHelper'
import { isEvmChainAsset, isEvmChainToken } from '../../../../helpers/evmHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getPoolPriceValue } from '../../../../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../../../../helpers/poolHelperMaya'
import { loadingString } from '../../../../helpers/stringHelper'
import { getEVMAmountFromBalances } from '../../../../helpers/walletHelper'
import { MayaScanPriceRD } from '../../../../hooks/useMayascanPrice'
import { usePricePool } from '../../../../hooks/usePricePool'
import { usePricePoolMaya } from '../../../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_DEPOSIT_STATE, INITIAL_SEND_STATE } from '../../../../services/chain/const'
import { DepositState, DepositStateHandler, SendTxState, SendTxStateHandler } from '../../../../services/chain/types'
import { FeesRD, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { TxParams } from '../../../../services/evm/types'
import { PoolDetails as PoolDetailsMaya } from '../../../../services/midgard/mayaMigard/types'
import { PoolAddress, PoolDetails } from '../../../../services/midgard/midgardTypes'
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
import * as H from '../TxForm.helpers'
import * as Styled from '../TxForm.styles'
import { validateTxAmountInput } from '../TxForm.util'
import { DEFAULT_FEE_OPTION } from './Send.const'
import * as Shared from './Send.shared'

type FormValues = {
  recipient: Address
  amount: BigNumber
  memo?: string
}

export type Props = {
  asset: SelectedWalletAsset
  trustedAddresses: TrustedAddresses | undefined
  balances: WalletBalances
  balance: WalletBalance
  transfer$: SendTxStateHandler
  deposit$: DepositStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  fees: FeesRD
  reloadFeesHandler: (params: TxParams) => void
  validatePassword$: ValidatePasswordHandler
  network: Network
  poolDetails: PoolDetails | PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
  oPoolAddressMaya: O.Option<PoolAddress>
  mayaScanPrice: MayaScanPriceRD
}

export const SendFormEVM = (props: Props): JSX.Element => {
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
    fees: feesRD,
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

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = useMemo(
    () => (!isChainOfMaya(asset.chain) ? pricePoolThor : pricePoolMaya),
    [asset.chain, pricePoolThor, pricePoolMaya]
  )

  const [selectedFeeOption, setSelectedFeeOption] = useState<FeeOption>(DEFAULT_FEE_OPTION)

  const [amountToSend, setAmountToSend] = useState<O.Option<BaseAmount>>(O.none)
  const [recipientAddress, setRecipientAddress] = useState<O.Option<Address>>(O.none)
  const [poolDeposit, setPoolDeposit] = useState<boolean>(false)
  const [oProtocol, setProtocol] = useState<O.Option<Chain>>(O.none)

  const [warningMessage, setWarningMessage] = useState<string>('')
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

  const [form] = Form.useForm<FormValues>()

  const prevFeesRef = useRef<O.Option<Fees>>(O.none)

  const oFees: O.Option<Fees> = useMemo(() => FP.pipe(feesRD, RD.toOption), [feesRD])

  const [assetFee, setAssetFee] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  const [feePriceValue, setFeePriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [amountPriceValue, setAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const feesAvailable = useMemo(() => O.isSome(oFees), [oFees])
  const [notAllowed, setNotAllowed] = useState<boolean>(false)

  const [currentMemo, setCurrentMemo] = useState<string>('')

  const isChainAsset = isEvmChainAsset(asset)
  const oSavedAddresses: O.Option<TrustedAddress[]> = useMemo(
    () =>
      FP.pipe(O.fromNullable(trustedAddresses?.addresses), O.map(A.filter((address) => address.chain === asset.chain))),
    [trustedAddresses, asset.chain]
  )

  const handleMemo = useCallback(() => {
    const memoValue = form.getFieldValue('memo') as string
    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [form])

  const { inboundAddress, routers } = useMemo(() => {
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

    const routers = {
      THOR: FP.pipe(
        oPoolAddress,
        O.fold(
          () => O.none,
          (details) => details.router
        )
      ),
      MAYA: FP.pipe(
        oPoolAddressMaya,
        O.fold(
          () => O.none,
          (details) => details.router
        )
      )
    }

    return { inboundAddress, routers }
  }, [oPoolAddress, oPoolAddressMaya])

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
        O.map((fees) => {
          setAssetFee(new CryptoAmount(fees[selectedFeeOption], getChainAsset(asset.chain)))
          return fees[selectedFeeOption]
        })
      ),
    [asset, oFees, selectedFeeOption]
  )

  const oAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset
    if (isChainAsset) return O.some(balance.amount)

    // or check list of other assets to get eth balance
    const result = FP.pipe(getEVMAmountFromBalances(balances, getChainAsset(asset.chain)), O.map(assetToBase))
    return result
  }, [asset.chain, balance.amount, balances, isChainAsset])

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
        setWarningMessage('')
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      if (!validateAddress(value.toLowerCase())) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }
      if (inboundAddress[THORChain] === value || inboundAddress['MAYA'] === value) {
        const dexInbound = inboundAddress[THORChain] === value ? 'Thorchain' : 'Mayachain'
        const type = `${dexInbound} ${asset.chain} Inbound`
        setProtocol(O.some(inboundAddress[THORChain] === value ? THORChain : MayaChain)) // if an inbound address is of TC we assume they want to deposit to TC else its mayachain
        setWarningMessage(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type: type }))
      } else {
        setWarningMessage('')
      }

      if (checkAddress(routers.THOR, value) || checkAddress(routers.MAYA, value)) {
        const dexInbound = checkAddress(routers.THOR, value) ? 'Thorchain' : 'Mayachain'
        const type = `${dexInbound} ${asset.chain} router`
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type }))
      }
    },
    [inboundAddress, routers.THOR, routers.MAYA, intl, asset.chain]
  )

  const handleSavedAddressSelect = useCallback(
    (value: string) => {
      form.setFieldsValue({ recipient: value })
      setRecipientAddress(O.fromNullable(value))
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
    [addressValidator, form, oSavedAddresses]
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

  // max amount for eth
  const maxAmount: BaseAmount = useMemo(() => {
    const maxEthAmount: BigNumber = FP.pipe(
      sequenceTOption(selectedFee, oAssetAmount),
      O.fold(
        // Set maxAmount to zero if we dont know anything about eth and fee amounts
        () => ZERO_BN,
        ([fee, assetAmount]) => {
          const max = assetAmount.amount().minus(fee.amount())
          return max.isGreaterThan(0) ? max : ZERO_BN
        }
      )
    )
    return isChainAsset ? baseAmount(maxEthAmount, balance.amount.decimal) : balance.amount
  }, [selectedFee, oAssetAmount, isChainAsset, balance.amount])

  // store maxAmountValue
  const [maxAmmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  const isPoolDetails = (poolDetails: PoolDetails | PoolDetailsMaya): poolDetails is PoolDetails => {
    return (poolDetails as PoolDetails) !== undefined
  }

  // useEffect to fetch data from query
  useEffect(() => {
    const amountValue = O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend)

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
    asset,
    maxAmount,
    assetFee,
    amountToSend,
    pricePool.asset,
    pricePool,
    network,
    poolDetails,
    sourceChainAsset,
    pricePoolMaya,
    mayaScanPrice
  ])

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

    const amount = FP.pipe(
      amountToSend,
      O.fold(
        // reset value to ZERO whenever amount is not set
        () =>
          formatAssetAmountCurrency({
            amount: baseToAsset(ZERO_BASE_AMOUNT), // Find the value of swap slippage
            asset: asset,
            decimal: isUSDAsset(asset) ? 2 : 6,
            trimZeros: !isUSDAsset(asset)
          }),
        (amount) =>
          formatAssetAmountCurrency({
            amount: baseToAsset(amount), // Find the value of swap slippage
            asset: asset,
            decimal: isUSDAsset(asset) ? 2 : 6,
            trimZeros: !isUSDAsset(asset)
          })
      )
    )

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
        msg3: isChainAsset
          ? intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
          : intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
      }
      return validateTxAmountInput({ input: value, maxAmount: baseToAsset(maxAmount), errors })
    },
    [intl, isChainAsset, maxAmount]
  )

  const renderSlider = useMemo(() => {
    const amountValue = O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend)
    const maxAmountValue = maxAmount.amount()
    const percentage = maxAmountValue.isZero()
      ? 0
      : amountValue
          .amount()
          .dividedBy(maxAmountValue)
          .multipliedBy(100)
          // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
          .decimalPlaces(0, BigNumber.ROUND_DOWN)
          .toNumber()

    const setAmountToSendFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmount.amount().multipliedBy(percents / 100)
      return setAmountToSend(O.some(baseAmount(amountFromPercentage, maxAmount.decimal)))
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
  const checkAddress = (routerOption: O.Option<string>, address: string): boolean =>
    O.fold(
      () => false, // If None, return false
      (routerAddress: string) => {
        return routerAddress === address
      } // If Some, compare the address
    )(routerOption)
  const [matchedAddresses, setMatchedAddresses] = useState<O.Option<TrustedAddress[]>>(O.none)
  const onChangeAddress = useCallback(
    async ({ target }: React.ChangeEvent<HTMLInputElement>) => {
      const address = target.value

      if (address) {
        const matched = FP.pipe(
          oSavedAddresses,
          O.map((addresses) => addresses.filter((addr) => addr.address.toLowerCase().includes(address.toLowerCase()))),
          O.chain(O.fromPredicate((filteredAddresses) => filteredAddresses.length > 0))
        )
        setMatchedAddresses(matched)

        // Validate the address
        const isNotAllowed =
          checkAddress(routers.MAYA, address) || (checkAddress(routers.THOR, address) && !isChainAsset)
        setNotAllowed(isNotAllowed)

        addressValidator(undefined, address)
          .then(() => {
            setRecipientAddress(O.some(address))
          })
          .catch(() => {
            setRecipientAddress(O.none)
            setNotAllowed(true)
          })
      } else {
        setRecipientAddress(O.none)
        setNotAllowed(false)
        setMatchedAddresses(O.none)
      }
    },
    [addressValidator, isChainAsset, oSavedAddresses, routers.MAYA, routers.THOR]
  )

  const reloadFees = useCallback(() => {
    const result = FP.pipe(
      sequenceTOption(amountToSend, recipientAddress),
      O.map(([amount, recipient]) => {
        reloadFeesHandler({ amount, recipient, asset, memo: currentMemo, from: walletAddress })
        return true
      }),
      O.getOrElse(() => false)
    )

    return result
  }, [amountToSend, recipientAddress, reloadFeesHandler, asset, currentMemo, walletAddress])
  // const [showMemo, setShowMemo] = useState(false)

  // only render memo field for chain asset.
  const renderMemo = () => {
    return (
      <>
        <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
        <Form.Item name="memo">
          <Input size="large" disabled={isLoading} onBlur={reloadFees} onChange={handleMemo} />
        </Form.Item>
      </>
    )
  }

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const [showDetails, setShowDetails] = useState<boolean>(true)

  // State for visibility of Modal to confirm tx
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const submitSendTx = useCallback(
    () =>
      FP.pipe(
        sequenceTOption(amountToSend, recipientAddress),
        O.map(([amount, recipient]) => {
          setSendTxStartTime(Date.now())
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
              feeOption: selectedFeeOption,
              memo: currentMemo
            })
          )
          return true
        })
      ),
    [
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
      currentMemo
    ]
  )
  const submitDepositTx = useCallback(
    () =>
      FP.pipe(
        sequenceTOption(amountToSend, oPoolAddress, oPoolAddressMaya, oProtocol),
        O.map(([amount, poolAddressThor, poolAddressMaya, protocol]) => {
          setSendTxStartTime(Date.now())
          subscribeDepositState(
            deposit$({
              walletType,
              walletAccount,
              walletIndex,
              hdMode,
              sender: walletAddress,
              poolAddress: protocol === THORChain ? poolAddressThor : poolAddressMaya,
              asset,
              amount,
              memo: currentMemo,
              protocol: protocol
            })
          )
          return true
        })
      ),
    [
      amountToSend,
      oPoolAddress,
      oPoolAddressMaya,
      oProtocol,
      subscribeDepositState,
      deposit$,
      walletType,
      walletAccount,
      walletIndex,
      hdMode,
      walletAddress,
      asset,
      currentMemo
    ]
  )

  const renderConfirmationModal = useMemo(() => {
    const onSuccessHandler = () => {
      setShowConfirmationModal(false)
      poolDeposit ? submitDepositTx() : submitSendTx()
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
      const evmChainString = chainToString(asset.chain)
      const txtNeedsConnected = intl.formatMessage(
        {
          id: 'ledger.needsconnected'
        },
        { chain: evmChainString }
      )

      // extended description for ERC20 tokens only
      const description1 = isEvmChainToken(asset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: evmChainString }
          )}`
        : txtNeedsConnected

      const description2 = intl.formatMessage({ id: 'ledger.sign' })

      return (
        <LedgerConfirmationModal
          network={network}
          onSuccess={onSuccessHandler}
          onClose={onCloseHandler}
          visible={showConfirmationModal}
          chain={asset.chain} // not sure about this
          description1={description1}
          description2={description2}
          addresses={O.none}
        />
      )
    }
    return null
  }, [
    walletType,
    poolDeposit,
    submitDepositTx,
    submitSendTx,
    validatePassword$,
    asset,
    intl,
    network,
    showConfirmationModal
  ])

  const renderTxModal = useMemo(
    () =>
      poolDeposit
        ? FP.pipe(
            amountToSend,
            O.fold(
              () => <></>,
              (amount) =>
                Shared.renderDepositModal({
                  asset,
                  amountToSend: amount,
                  network,
                  depositState,
                  resetDepositState,
                  sendTxStartTime,
                  openExplorerTxUrl,
                  getExplorerTxUrl,
                  intl
                })
            )
          )
        : FP.pipe(
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
      poolDeposit,
      amountToSend,
      asset,
      network,
      depositState,
      resetDepositState,
      sendTxStartTime,
      openExplorerTxUrl,
      getExplorerTxUrl,
      intl,
      sendTxState,
      resetSendTxState
    ]
  )

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        feesRD,
        RD.map((fees) => [{ asset: getChainAsset(asset.chain), amount: fees[selectedFeeOption] }]),
        RD.mapLeft((error) => {
          // Transform the error but do not perform side effects here
          return new Error(`${error.message.split(':')[0]}`) // Example transformation
        })
      ),
    [asset.chain, feesRD, selectedFeeOption]
  )

  // Use useEffect to handle the side effect based on the error state
  useEffect(() => {
    if (RD.isFailure(uiFeesRD)) {
      // Perform the side effect when there is an error
      setAmountToSend(O.none)
      reloadFees()
    }
  }, [uiFeesRD, asset.chain, reloadFees])

  const addMaxAmountHandler = useCallback(() => setAmountToSend(O.some(maxAmount)), [maxAmount])

  const renderFeeOptions = useMemo(() => {
    const onChangeHandler = (e: string) => {
      setSelectedFeeOption(e as FeeOption)
    }
    const disabled = !feesAvailable || isLoading

    return (
      <RadioGroup
        className="flex flex-col lg:flex-row lg:space-x-2"
        onChange={onChangeHandler}
        value={selectedFeeOption}
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
  }, [feeOptionsLabel, feesAvailable, isLoading, selectedFeeOption])

  const handleOnKeyUp = useCallback(() => {
    setRecipientAddress(O.some(form.getFieldValue('recipient')))
  }, [form])

  const oMatchedWalletType: O.Option<WalletType> = useMemo(() => {
    const recipientAddressValue = FP.pipe(
      recipientAddress,
      O.getOrElse(() => '')
    )
    return H.matchedWalletType(balances, recipientAddressValue)
  }, [balances, recipientAddress])

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
          initialValues={{
            // default value for BigNumberInput
            amount: bn(0),
            // Default value for RadioGroup of feeOptions
            fee: DEFAULT_FEE_OPTION
          }}
          onFinish={() => setShowConfirmationModal(true)}
          labelCol={{ span: 24 }}>
          <Styled.SubForm>
            {renderSavedAddressesDropdown}
            <Styled.CustomLabel size="big">
              {intl.formatMessage({ id: 'common.address' })}
              {renderWalletType}
            </Styled.CustomLabel>
            <Form.Item rules={[{ required: true, validator: addressValidator }]} name="recipient">
              <Input size="large" disabled={isLoading} onChange={onChangeAddress} onKeyUp={handleOnKeyUp} />
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
              className="mb-10px"
              color="neutral"
              balance={{ amount: maxAmount, asset }}
              maxDollarValue={maxAmmountPriceValue}
              onClick={addMaxAmountHandler}
              disabled={isLoading}
            />
            <div className="w-full py-2">{renderSlider}</div>
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFees} disabled={isLoading} />
            {renderFeeError}
            <Form.Item name="fee">{renderFeeOptions}</Form.Item>

            {/* Advanced Settings Section */}
            {isChainAsset && (
              <div className="mt-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                {/* Switch for Pool Deposit */}
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
          </Styled.SubForm>
          <FlatButton
            className="mt-40px min-w-[200px]"
            loading={isLoading}
            disabled={!feesAvailable || isLoading || notAllowed}
            type="submit"
            size="large">
            {poolDeposit
              ? intl.formatMessage({ id: 'wallet.action.deposit' })
              : intl.formatMessage({ id: 'wallet.action.send' })}
          </FlatButton>
        </Styled.Form>
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
                  recipient={FP.pipe(
                    recipientAddress,
                    O.getOrElse(() => '')
                  )}
                  amountLabel={amountLabel}
                  priceFeeLabel={priceFeeLabel}
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
