import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Cog8ToothIcon } from '@heroicons/react/20/solid'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { FeeOption, Fees, Network } from '@xchainjs/xchain-client'
import { validateAddress } from '@xchainjs/xchain-evm'
import { PoolDetails } from '@xchainjs/xchain-midgard'
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
  CryptoAmount
} from '@xchainjs/xchain-util'
import { Form } from 'antd'
import Tooltip from 'antd/es/tooltip'
import { RadioChangeEvent } from 'antd/lib/radio'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { Dex } from '../../../../../shared/api/types'
import { chainToString } from '../../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT, ZERO_BN } from '../../../../const'
import { isAvaxAsset, isBscAsset, isEthAsset, isUSDAsset } from '../../../../helpers/assetHelper'
import { getChainAsset } from '../../../../helpers/chainHelper'
import { sequenceTOption } from '../../../../helpers/fpHelpers'
import { getPoolPriceValue } from '../../../../helpers/poolHelper'
import { loadingString } from '../../../../helpers/stringHelper'
import { getEVMAmountFromBalances } from '../../../../helpers/walletHelper'
import { usePricePool } from '../../../../hooks/usePricePool'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { INITIAL_SAVER_DEPOSIT_STATE, INITIAL_SEND_STATE } from '../../../../services/chain/const'
import {
  SaverDepositState,
  SaverDepositStateHandler,
  SendTxState,
  SendTxStateHandler
} from '../../../../services/chain/types'
import { FeesRD, GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../../../services/clients'
import { TxParams } from '../../../../services/evm/types'
import { PoolAddress } from '../../../../services/midgard/types'
import { SelectedWalletAsset, ValidatePasswordHandler } from '../../../../services/wallet/types'
import { WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import * as StyledR from '../../../shared/form/Radio.styles'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
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
  recipient: Address
  amount: BigNumber
  memo?: string
}

export type Props = {
  asset: SelectedWalletAsset
  balances: WalletBalances
  balance: WalletBalance
  transfer$: SendTxStateHandler
  deposit$: SaverDepositStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  fees: FeesRD
  reloadFeesHandler: (params: TxParams) => void
  validatePassword$: ValidatePasswordHandler
  network: Network
  poolDetails: PoolDetails
  oPoolAddress: O.Option<PoolAddress>
  dex: Dex
}

export const SendFormEVM: React.FC<Props> = (props): JSX.Element => {
  const {
    asset: { walletType, walletIndex, hdMode, walletAddress },
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
    dex
  } = props

  const intl = useIntl()

  const { asset } = balance
  const sourceChainAsset = getChainAsset(asset.chain)
  const pricePool = usePricePool()

  const [selectedFeeOption, setSelectedFeeOption] = useState<FeeOption>(DEFAULT_FEE_OPTION)

  const [amountToSend, setAmountToSend] = useState<O.Option<BaseAmount>>(O.none)
  const [sendAddress, setSendAddress] = useState<O.Option<Address>>(O.none)
  const [poolDeposit, setPoolDeposit] = useState<boolean>(false)

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
  } = useSubscriptionState<SaverDepositState>(INITIAL_SAVER_DEPOSIT_STATE)

  const isLoading = useMemo(() => RD.isPending(sendTxState.status), [sendTxState.status])

  const [form] = Form.useForm<FormValues>()

  const prevFeesRef = useRef<O.Option<Fees>>(O.none)

  const oFees: O.Option<Fees> = useMemo(() => FP.pipe(feesRD, RD.toOption), [feesRD])

  const [assetFee, setAssetFee] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  const [feePriceValue, setFeePriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const [amountPriceValue, setAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))
  const feesAvailable = useMemo(() => O.isSome(oFees), [oFees])

  const [InboundAddress, setInboundAddress] = useState<string>('')
  const [routerAddress, setRouterAddress] = useState<O.Option<string>>(O.none)

  const [swapMemoDetected, setSwapMemoDetected] = useState<boolean>(false)
  const [notAllowed, setNotAllowed] = useState<boolean>(false)

  const [currentMemo, setCurrentMemo] = useState('')
  const [affiliateTracking, setAffiliateTracking] = useState<string>('')

  const handleMemo = useCallback(() => {
    let memoValue = form.getFieldValue('memo') as string

    const isChainAsset = isEthAsset(asset) || isAvaxAsset(asset) || isBscAsset(asset)

    // Check if a swap memo is detected
    if (checkMemo(memoValue)) {
      memoValue = memoCorrection(memoValue)
      setSwapMemoDetected(true)

      // Set affiliate tracking message
      setAffiliateTracking(
        isChainAsset
          ? intl.formatMessage({ id: 'wallet.send.affiliateTracking' })
          : intl.formatMessage({ id: 'wallet.send.notAllowed' })
      ) //Swap memo detected 10bps affiliate fee applied
      setNotAllowed(!isChainAsset) // don't allow erc to send memo
    } else {
      setSwapMemoDetected(false)
      setNotAllowed(false) // reset if not a swap memo
    }

    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [asset, form, intl])

  // useEffect to fetch data from query
  useEffect(() => {
    FP.pipe(
      oPoolAddress,
      O.fold(
        () => {
          setInboundAddress('')
          setRouterAddress(O.none)
        },
        (poolDetails) => {
          setInboundAddress(poolDetails.address)
          setRouterAddress(poolDetails.router)
        }
      )
    )
  }, [oPoolAddress, asset.chain])

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
          setAssetFee(new CryptoAmount(fees[selectedFeeOption], asset))
          return fees[selectedFeeOption]
        })
      ),
    [asset, oFees, selectedFeeOption]
  )

  const oAssetAmount: O.Option<BaseAmount> = useMemo(() => {
    // return balance of current asset
    if (isEthAsset(asset) || isAvaxAsset(asset) || isBscAsset(asset)) {
      return O.some(balance.amount)
    }
    // or check list of other assets to get eth balance
    return FP.pipe(getEVMAmountFromBalances(balances, getChainAsset(asset.chain)), O.map(assetToBase))
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
      setWarningMessage('')
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      if (!validateAddress(value.toLowerCase())) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }
      if (InboundAddress === value) {
        const dexInbound = dex === 'THOR' ? 'Thorchain' : 'Mayachain'
        const type = `${dexInbound} Inbound`
        setWarningMessage(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type: type }))
      }
      const currentRouterAddress = FP.pipe(
        routerAddress,
        O.getOrElse(() => '')
      )
      if (currentRouterAddress === value) {
        const dexInbound = dex === 'THOR' ? 'Thorchain' : 'Mayachain'
        const type = `${dexInbound} Inbound`
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.inbound' }, { type }))
      }
    },
    [InboundAddress, routerAddress, intl, dex]
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
    return isEthAsset(asset) ? baseAmount(maxEthAmount, balance.amount.decimal) : balance.amount
  }, [selectedFee, oAssetAmount, asset, balance.amount])

  // store maxAmountValue
  const [maxAmmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(baseAmount(0), asset))

  // useEffect to fetch data from query
  useEffect(() => {
    const amountValue = O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend)
    const maxAmountPrice = getPoolPriceValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool
    })
    const amountPrice = getPoolPriceValue({
      balance: { asset, amount: amountValue },
      poolDetails,
      pricePool
    })
    const assetFeePrice = getPoolPriceValue({
      balance: { asset: sourceChainAsset, amount: assetFee.baseAmount },
      poolDetails,
      pricePool
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
  }, [asset, maxAmount, assetFee, amountToSend, pricePool.asset, pricePool, network, poolDetails, sourceChainAsset])

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
        msg3: isEthAsset(asset)
          ? intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
          : intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
      }
      return validateTxAmountInput({ input: value, maxAmount: baseToAsset(maxAmount), errors })
    },
    [asset, intl, maxAmount]
  )

  const renderSlider = useMemo(() => {
    const amountValue = O.getOrElse(() => ZERO_BASE_AMOUNT)(amountToSend)
    const percentage = amountValue
      .amount()
      .dividedBy(maxAmount.amount())
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
        tooltipVisible
        tipFormatter={(value) => `${value}%`}
        withLabel
        tooltipPlacement={'top'}
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

  const onChangeAddress = useCallback(
    async ({ target }: React.ChangeEvent<HTMLInputElement>) => {
      const address = target.value

      // we have to validate input before storing into the state
      addressValidator(undefined, address)
        .then(() => {
          setSendAddress(O.some(address))
          setPoolDeposit(address === InboundAddress)
        })
        .catch(() => setSendAddress(O.none))
    },
    [addressValidator, InboundAddress]
  )

  const reloadFees = useCallback(() => {
    const result = FP.pipe(
      sequenceTOption(amountToSend, sendAddress),
      O.map(([amount, recipient]) => {
        reloadFeesHandler({ amount, recipient, asset, memo: currentMemo, from: walletAddress })
        return true
      }),
      O.getOrElse(() => false)
    )

    return result
  }, [amountToSend, sendAddress, reloadFeesHandler, asset, currentMemo, walletAddress])
  const [showMemo, setShowMemo] = useState(false)

  // only render memo field for chain asset.
  const renderMemo = useMemo(() => {
    return (
      <>
        <Styled.CustomLabel size="big">{intl.formatMessage({ id: 'common.memo' })}</Styled.CustomLabel>
        <Form.Item name="memo">
          <Styled.Input size="large" disabled={isLoading} onBlur={reloadFees} onChange={handleMemo} />
        </Form.Item>
      </>
    )
  }, [handleMemo, intl, isLoading, reloadFees])

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const [showDetails, setShowDetails] = useState<boolean>(true)

  // State for visibility of Modal to confirm tx
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const submitSendTx = useCallback(
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
              memo: currentMemo
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
      currentMemo
    ]
  )
  const submitDepositTx = useCallback(
    () =>
      FP.pipe(
        sequenceTOption(amountToSend, oPoolAddress),
        O.map(([amount, poolAddress]) => {
          setSendTxStartTime(Date.now())
          subscribeDepositState(
            deposit$({
              walletType,
              walletIndex,
              hdMode,
              sender: walletAddress,
              poolAddress,
              asset,
              amount,
              memo: currentMemo,
              dex
            })
          )
          return true
        })
      ),
    [
      amountToSend,
      oPoolAddress,
      subscribeDepositState,
      deposit$,
      walletType,
      walletIndex,
      hdMode,
      walletAddress,
      asset,
      currentMemo,
      dex
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
      const description1 =
        !isEthAsset(asset) || !isAvaxAsset(asset) || !isBscAsset(asset)
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
      setSendAddress(O.none)
      setAmountToSend(O.none)
      reloadFees()
    }
    // Add uiFeesRD as a dependency to trigger the effect when it changes
  }, [uiFeesRD, form, asset.chain, reloadFees])

  const addMaxAmountHandler = useCallback(() => setAmountToSend(O.some(maxAmount)), [maxAmount])

  const renderFeeOptions = useMemo(() => {
    const onChangeHandler = (e: RadioChangeEvent) => {
      setSelectedFeeOption(e.target.value)
      setAmountToSend(amountToSend)
    }
    const disabled = !feesAvailable || isLoading

    return (
      <StyledR.Radio.Group onChange={onChangeHandler} value={selectedFeeOption} disabled={disabled}>
        <StyledR.Radio value="average" key="average">
          <StyledR.RadioLabel disabled={disabled}>{feeOptionsLabel['average']}</StyledR.RadioLabel>
        </StyledR.Radio>
        <StyledR.Radio value="fast" key="fast">
          <StyledR.RadioLabel disabled={disabled}>{feeOptionsLabel['fast']}</StyledR.RadioLabel>
        </StyledR.Radio>
        <StyledR.Radio value="fastest" key="fastest">
          <StyledR.RadioLabel disabled={disabled}>{feeOptionsLabel['fastest']}</StyledR.RadioLabel>
        </StyledR.Radio>
      </StyledR.Radio.Group>
    )
  }, [amountToSend, feeOptionsLabel, feesAvailable, isLoading, selectedFeeOption])

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
                onChange={onChangeAddress}
                onKeyUp={handleOnKeyUp}
              />
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
            <div className="w-full px-20px pb-10px">{renderSlider}</div>
            <Styled.Fees fees={uiFeesRD} reloadFees={reloadFees} disabled={isLoading} />
            {renderFeeError}

            {swapMemoDetected && <div className="pb-20px text-warning0 dark:text-warning0d ">{affiliateTracking}</div>}
            <Form.Item name="fee">{renderFeeOptions}</Form.Item>
            <Styled.SettingsWrapper onClick={() => setShowMemo(!showMemo)}>
              <Tooltip title={intl.formatMessage({ id: 'common.settings' })}>
                <Cog8ToothIcon
                  className={`ease h-[24px] w-[24px] text-text2 ${showMemo ? 'rotate-180' : ''} dark:text-text2d`}
                />
              </Tooltip>
            </Styled.SettingsWrapper>
            {showMemo && renderMemo}
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
      </Styled.Container>

      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </>
  )
}
