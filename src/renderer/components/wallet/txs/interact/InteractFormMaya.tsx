import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { AssetAETH } from '@xchainjs/xchain-arbitrum'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetCacao, CACAO_DECIMAL, MAYAChain } from '@xchainjs/xchain-mayachain'
import { MayachainQuery, QuoteMAYANameParams, MAYANameDetails } from '@xchainjs/xchain-mayachain-query'
import { PoolDetails } from '@xchainjs/xchain-mayamidgard'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import {
  BaseAmount,
  CryptoAmount,
  assetAmount,
  assetToBase,
  assetToString,
  baseAmount,
  baseToAsset,
  bn,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { either as E, function as FP, option as O } from 'fp-ts'
import { debounce } from 'lodash'
import { useForm, Controller } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { ONE_CACAO_BASE_AMOUNT } from '../../../../../shared/mock/amount'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isUSDAsset } from '../../../../helpers/assetHelper'
import { validateAddress } from '../../../../helpers/form/validation'
import {
  getBondMemoMayanode,
  getLeaveMemo,
  getUnbondMemoMayanode,
  getWhitelistMemo,
  Action,
  getProtocolPoolMemo
} from '../../../../helpers/memoHelper'
import { getUSDValue } from '../../../../helpers/poolHelperMaya'
import { emptyString } from '../../../../helpers/stringHelper'
import { useBondableAssets } from '../../../../hooks/useBondableAssets'
import { useNetwork } from '../../../../hooks/useNetwork'
import { usePricePoolMaya } from '../../../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../services/clients'
import { INITIAL_INTERACT_STATE } from '../../../../services/mayachain/const'
import {
  InteractState,
  InteractStateHandler,
  MayaLpUnits,
  NodeInfos,
  NodeInfosRD,
  CacaoPoolProvider,
  CacaoPoolProviderRD,
  LastblockItems
} from '../../../../services/mayachain/types'
import { PoolShare, PoolSharesRD } from '../../../../services/midgard/midgardTypes'
import { ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { TxModal } from '../../../modal/tx'
import { SendAsset } from '../../../modal/tx/extra/SendAsset'
import { AssetIcon } from '../../../uielements/assets/assetIcon'
import { BaseButton, FlatButton, ViewTxButton } from '../../../uielements/button'
import { CheckButton } from '../../../uielements/button/CheckButton'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { SwitchButton } from '../../../uielements/button/SwitchButton'
import { Fees, UIFees, UIFeesRD } from '../../../uielements/fees'
import { InfoIcon } from '../../../uielements/info'
import { Input, InputBigNumber } from '../../../uielements/input'
import { Label } from '../../../uielements/label'
import { RadioGroup, Radio } from '../../../uielements/radio'
import { Switch } from '../../../uielements/switch'
import { Tooltip } from '../../../uielements/tooltip'
import { validateTxAmountInput } from '../TxForm.util'
import * as H from './Interact.helpers'
import { InteractType } from './Interact.types'

type FormValues = {
  memo: string
  mayaAddress: string
  providerAddress: string
  operatorFee: number
  amount: BigNumber
  mayaname: string
  chainAddress: string
  chain: string
  preferredAsset: string
  expiry: string
  bondLpUnits: string
  assetPool: string
  aliasChain: string
  aliasAddress: string
}
type UserNodeInfo = {
  nodeAddress: string
  walletAddress: string
  pools: MayaLpUnits[]
}

type Props = {
  interactType: InteractType
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  balance: WalletBalance
  interactMaya$: InteractStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  fee: FeeRD
  reloadFeesHandler: FP.Lazy<void>
  addressValidation: AddressValidation
  validatePassword$: ValidatePasswordHandler
  mayachainQuery: MayachainQuery
  network: Network
  poolDetails: PoolDetails
  nodes: NodeInfosRD
  poolShares: PoolSharesRD
  cacaoPoolProvider: CacaoPoolProviderRD
  mayachainLastblockRD: RD.RemoteData<Error, LastblockItems>
  mimirRD: RD.RemoteData<Error, { [key: string]: number }>
}
export const InteractFormMaya = (props: Props) => {
  const {
    interactType,
    poolDetails,
    balance,
    walletType,
    hdMode,
    walletAccount,
    walletIndex,
    interactMaya$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    addressValidation,
    fee: feeRD,
    reloadFeesHandler,
    validatePassword$,
    mayachainQuery,
    network,
    nodes: nodesRD,
    poolShares,
    cacaoPoolProvider: cacaoPoolProviderRd,
    mayachainLastblockRD,
    mimirRD
  } = props
  const intl = useIntl()

  const { asset } = balance
  const { walletAddress } = balance
  const pricePool = usePricePoolMaya()

  const [userNodeInfo, setUserNodeInfo] = useState<UserNodeInfo | undefined>(undefined)
  const [_amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const [cacaoPoolAction, setCacaoPoolAction] = useState<Action>(Action.add)

  const nodes: NodeInfos = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.getOrElse(() => [] as NodeInfos)
      ),
    [nodesRD]
  )
  const cacaoPoolProvider: CacaoPoolProvider = useMemo(() => {
    const defaultCacaoPoolProvider: CacaoPoolProvider = {
      address: '',
      value: baseAmount(0),
      pnl: baseAmount(0),
      depositAmount: baseAmount(0),
      withdrawAmount: baseAmount(0),
      addHeight: O.none,
      withdrawHeight: O.none,
      walletType: undefined
    }

    if (!cacaoPoolProviderRd) {
      return defaultCacaoPoolProvider
    }

    const provider = FP.pipe(
      cacaoPoolProviderRd,
      RD.getOrElse(() => {
        return defaultCacaoPoolProvider
      })
    )
    return provider
  }, [cacaoPoolProviderRd])

  // Maya maturity period logic similar to Thor
  const useCacaoPoolProviderMaturity = (
    cacaoPoolProviderRd: RD.RemoteData<Error, { addHeight: O.Option<number> }>,
    mayachainLastblockRd: RD.RemoteData<Error, LastblockItems>,
    mimirKeys: { [key: string]: number }
  ) => {
    return useMemo(() => {
      return FP.pipe(
        RD.combine(cacaoPoolProviderRd, mayachainLastblockRd),
        RD.chain(([cacaoPoolProvider, lastblocks]) => {
          return FP.pipe(
            cacaoPoolProvider.addHeight,
            O.fold(
              () => RD.failure(new Error('addHeight is not available')),
              (addHeight) => {
                const mayaBlock = lastblocks.find((block) => block.mayachain)
                return mayaBlock
                  ? RD.success({
                      addHeight,
                      lastBlock: mayaBlock.mayachain,
                      cacaoPoolMimir: mimirKeys['CACAOPOOLDEPOSITMATURITYBLOCKS']
                    })
                  : RD.failure(new Error('Maya block not found'))
              }
            )
          )
        }),
        RD.map(({ addHeight, lastBlock, cacaoPoolMimir }) => {
          return H.getBlocksLeft(lastBlock, addHeight, cacaoPoolMimir)
        })
      )
    }, [cacaoPoolProviderRd, mayachainLastblockRd, mimirKeys])
  }

  const mimirKeys = FP.pipe(
    mimirRD,
    RD.getOrElse(() => ({}) as { [key: string]: number })
  )

  const cacaoPoolData = useCacaoPoolProviderMaturity(cacaoPoolProviderRd, mayachainLastblockRD, mimirKeys)
  const cacaoPoolAvailable = mimirKeys['CACAOPOOLENABLED'] === 1
  useEffect(() => {
    let foundNodeInfo: UserNodeInfo | undefined = undefined

    for (const node of nodes) {
      const matchingProvider = node.bondProviders.providers.find((provider) => walletAddress === provider.bondAddress)

      if (matchingProvider) {
        foundNodeInfo = {
          nodeAddress: node.address,
          walletAddress: matchingProvider.bondAddress,
          pools: matchingProvider.pools
        }
        break
      }
    }

    if (foundNodeInfo) {
      setUserNodeInfo(foundNodeInfo)
    } else {
      setUserNodeInfo(undefined)
    }
  }, [nodes, walletAddress])

  const [memo, setMemo] = useState<string>('')
  const amountToSend = useMemo(() => {
    switch (interactType) {
      case InteractType.Bond:
      case InteractType.Whitelist:
        return ONE_CACAO_BASE_AMOUNT
      case InteractType.Custom:
      case InteractType.MAYAName:
      case InteractType.THORName:
      case InteractType.RunePool:
        return _amountToSend
      case InteractType.Unbond:
      case InteractType.Leave:
        return ZERO_BASE_AMOUNT
      case InteractType.CacaoPool: {
        const amnt = cacaoPoolAction === Action.add ? _amountToSend : ZERO_BASE_AMOUNT
        return amnt
      }
    }
  }, [_amountToSend, interactType, cacaoPoolAction])

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      mayaAddress: '',
      amount: bn(0),
      chain: MAYAChain,
      chainAddress: balance.walletAddress,
      expiry: '1',
      memo: '',
      providerAddress: '',
      operatorFee: 0,
      mayaname: '',
      preferredAsset: '',
      bondLpUnits: '',
      assetPool: '',
      aliasChain: '',
      aliasAddress: ''
    }
  })
  const [currentMemo, setCurrentMemo] = useState('')
  const [whitelisting, setWhitelisting] = useState<boolean>(true)

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  // state variable for mayanames
  const [oMayaname, setMayaname] = useState<O.Option<MAYANameDetails>>(O.none)
  const [mayanameAvailable, setMayanameAvailable] = useState<boolean>(false) // if Mayaname is available
  const [mayanameUpdate, setMayanameUpdate] = useState<boolean>(false) // allow to update
  const [mayanameRegister, setMayanameRegister] = useState<boolean>(false) // allow to update
  const [mayanameQuoteValid, setMayanameQuoteValid] = useState<boolean>(false) // if the quote is valid then allow to buy
  const [isOwner, setIsOwner] = useState<boolean>(false) // if the mayaname.owner is the wallet address then allow to update
  // const [preferredAsset, setPreferredAsset] = useState<AnyAsset>()
  const [aliasChain, setAliasChain] = useState<string>('')

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
  const _handleMemo = useCallback(() => {
    const memoValue = watch('memo')
    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [watch])

  const renderFeeError = useMemo(
    () => (
      <Label size="big" color="error">
        {intl.formatMessage(
          { id: 'wallet.errors.fee.notCovered' },
          {
            balance: formatAssetAmountCurrency({
              amount: baseToAsset(balance.amount),
              asset: AssetCacao,
              trimZeros: true
            })
          }
        )}
      </Label>
    ),
    [intl, balance.amount]
  )
  const renderMayanameError = useMemo(
    () => (
      <Label size="big" color="error">
        {intl.formatMessage({ id: 'common.mayanameError' })}
      </Label>
    ),
    [intl]
  )

  // max amount for CacaoNative
  const maxAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oFee,
        O.fold(
          // Set maxAmount to zero if we dont know anything about fees
          () => ZERO_BASE_AMOUNT,
          (fee) => {
            if (interactType === InteractType.CacaoPool && cacaoPoolAction === Action.withdraw) {
              return cacaoPoolProvider.value.gt(0) ? cacaoPoolProvider.value : ZERO_BASE_AMOUNT
            } else {
              // For other interaction types, use the balance amount minus fee
              return balance.amount.minus(fee)
            }
          }
        )
      ),
    [oFee, balance.amount, interactType, cacaoPoolAction, cacaoPoolProvider.value]
  )

  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(maxAmount, asset)) // Initial state can be null or a suitable default

  useEffect(() => {
    const maxAmountPrice = getUSDValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool
    })

    if (
      (maxAmount && interactType === InteractType.Bond) ||
      interactType === InteractType.Custom ||
      interactType === InteractType.CacaoPool
    ) {
      if (O.isSome(maxAmountPrice)) {
        const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
        setMaxAmountPriceValue(maxCryptoAmount)
      }
    }
  }, [asset, interactType, maxAmount, mayachainQuery, network, poolDetails, pricePool])

  const amountValidator = useCallback(
    async (value: BigNumber) => {
      try {
        switch (interactType) {
          case InteractType.Bond:
            // similar to any other form for sending any amount
            await validateTxAmountInput({
              input: value,
              maxAmount: baseToAsset(maxAmount),
              errors: {
                msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
                msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
                msg3: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
              }
            })
            return true
          case InteractType.Unbond:
            await H.validateUnboundAmountInput({
              input: value,
              errors: {
                msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
                msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' })
              }
            })
            return true
          case InteractType.Custom:
            await H.validateCustomAmountInput({
              input: value,
              errors: {
                msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
                msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterOrEqualThan' }, { amount: '0' })
              }
            })
            return true
          case InteractType.CacaoPool:
            await H.validateCustomAmountInput({
              input: value,
              errors: {
                msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
                msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterOrEqualThan' }, { amount: '0' })
              }
            })
            return true
          case InteractType.Leave:
            return true
          default:
            return true
        }
      } catch (error) {
        return String(error)
      }
    },
    [interactType, intl, maxAmount]
  )

  const debouncedFetch = debounce(
    async (mayaname, setMayaname, setMayanameAvailable, setMayanameUpdate, setMayanameRegister, mayachainQuery) => {
      try {
        const mayanameDetails = await mayachainQuery.getMAYANameDetails(mayaname)
        if (mayanameDetails) {
          setMayaname(O.some(mayanameDetails))
          setMayanameAvailable(mayanameDetails.owner === '' || balance.walletAddress === mayanameDetails.owner)
          setMayanameUpdate(mayaname === mayanameDetails.name && mayanameDetails.owner === '')
          setMayanameRegister(mayanameDetails.name === '')
          setIsOwner(balance.walletAddress === mayanameDetails.owner)
        }
        if (mayanameDetails === undefined) {
          setMayanameAvailable(true)
          setMayanameRegister(true)
        }
      } catch (error) {
        // Handle error silently or with appropriate error handling
      }
    },
    500
  )

  const mayanameHandler = useCallback(() => {
    const mayaname = watch('mayaname')
    setMemo('')
    if (mayaname !== '') {
      debouncedFetch(
        mayaname,
        setMayaname,
        setMayanameAvailable,
        setMayanameUpdate,
        setMayanameRegister,
        mayachainQuery
      )
    }
  }, [debouncedFetch, watch, mayachainQuery])

  const estimateMayanameHandler = useCallback(() => {
    const currentDate = new Date()

    const mayaname = watch('mayaname')
    const chain = mayanameRegister ? watch('chain') : watch('aliasChain')
    const yearsToAdd = parseInt(watch('expiry'))
    const expirity =
      yearsToAdd === 1
        ? undefined
        : new Date(currentDate.getFullYear() + yearsToAdd, currentDate.getMonth(), currentDate.getDate())
    const chainAddress = mayanameRegister ? watch('chainAddress') : watch('aliasAddress')
    const owner = balance.walletAddress
    if (mayaname !== undefined && chain !== undefined && chainAddress !== undefined) {
      const fetchMayanameQuote = async () => {
        try {
          const params: QuoteMAYANameParams = {
            name: mayaname,
            chain,
            chainAddress,
            owner,
            expiry: expirity,
            isUpdate: mayanameUpdate || isOwner
          }
          const mayanameQuote = await mayachainQuery.estimateMAYAName(params)
          if (mayanameQuote) {
            setMemo(mayanameQuote.memo)
            setAmountToSend(mayanameQuote.value.baseAmount)
            setMayanameQuoteValid(true)
          }
        } catch (error) {
          console.error('Error fetching fetchMAYANameQuote:', error)
        }
      }
      fetchMayanameQuote()
    }
  }, [balance.walletAddress, watch, isOwner, mayachainQuery, mayanameRegister, mayanameUpdate])

  const handleRadioChainChange = useCallback((radioChain: string) => {
    setAliasChain(radioChain)
  }, [])

  const addMaxAmountHandler = useCallback(
    (maxAmount: BaseAmount) => {
      setAmountToSend(maxAmount)
    },
    [setAmountToSend]
  )

  const addressValidator = useCallback(
    async (value: string) => {
      const validationResult = validateAddress(
        addressValidation,
        intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' }),
        intl.formatMessage({ id: 'wallet.errors.address.invalid' })
      )(value)

      if (E.isLeft(validationResult)) {
        return validationResult.left
      } else {
        return true
      }
    },
    [addressValidation, intl]
  )

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const getMemo = useCallback(() => {
    const mayaNodeAddress = watch('mayaAddress')
    const whitelistAdd = watch('providerAddress')
    const nodeOperatorFee = watch('operatorFee')
    const assetPool = watch('assetPool')
    const lpUnits = watch('bondLpUnits')
    const feeInBasisPoints = nodeOperatorFee ? nodeOperatorFee * 100 : undefined
    let createMemo = ''
    switch (interactType) {
      case InteractType.Bond: {
        createMemo = getBondMemoMayanode(assetPool, lpUnits, mayaNodeAddress)
        break
      }
      case InteractType.Unbond: {
        createMemo = getUnbondMemoMayanode(assetPool, lpUnits, mayaNodeAddress)
        break
      }
      case InteractType.Leave: {
        createMemo = getLeaveMemo(mayaNodeAddress)
        break
      }
      case InteractType.Whitelist: {
        createMemo = getWhitelistMemo(whitelisting, MAYAChain, mayaNodeAddress, whitelistAdd, feeInBasisPoints)
        break
      }
      case InteractType.CacaoPool: {
        createMemo = getProtocolPoolMemo({
          action: cacaoPoolAction,
          bps: H.getProtocolPoolWithdrawBps(cacaoPoolProvider.value, _amountToSend),
          network
        })
        break
      }
      case InteractType.Custom: {
        createMemo = currentMemo
        break
      }
      case InteractType.MAYAName: {
        createMemo = memo
        break
      }
    }
    setMemo(createMemo)
    return createMemo
  }, [
    watch,
    interactType,
    whitelisting,
    cacaoPoolAction,
    cacaoPoolProvider.value,
    _amountToSend,
    network,
    currentMemo,
    memo
  ])

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(value)
        .then((isValid) => {
          if (isValid) {
            const newAmountToSend = assetToBase(assetAmount(value, CACAO_DECIMAL))
            setAmountToSend(newAmountToSend)
            setValue('amount', value)
          }
        })
        .catch(() => {})
      // do nothing, react-hook-form handles validation
    },
    [amountValidator, setValue]
  )

  useEffect(() => {
    // This code will run after the state has been updated
    getMemo()
  }, [amountToSend, getMemo])

  const submitTx = useCallback(() => {
    setSendTxStartTime(Date.now())

    subscribeInteractState(
      interactMaya$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        amount: amountToSend,
        memo: getMemo(),
        asset
      })
    )
  }, [
    subscribeInteractState,
    interactMaya$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    amountToSend,
    getMemo,
    asset
  ])

  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const resetForm = useCallback(() => {
    resetInteractState()
    reset({
      mayaAddress: '',
      amount: bn(0),
      chain: MAYAChain,
      chainAddress: balance.walletAddress,
      expiry: '1',
      memo: '',
      providerAddress: '',
      operatorFee: 0,
      mayaname: '',
      preferredAsset: '',
      bondLpUnits: '',
      assetPool: '',
      aliasChain: '',
      aliasAddress: ''
    })
    setMemo('')
    // Reset amount appropriately based on interaction type
    if (interactType === InteractType.Bond || interactType === InteractType.Whitelist) {
      setAmountToSend(ONE_CACAO_BASE_AMOUNT)
    } else {
      setAmountToSend(ZERO_BASE_AMOUNT)
    }
    setMayaname(O.none)
    setIsOwner(false)
    setMayanameQuoteValid(false)
    setMayanameUpdate(false)
    setMayanameAvailable(false)
  }, [reset, resetInteractState, balance.walletAddress, interactType])

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
        onClose={resetForm}
        onFinish={resetForm}
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
  }, [
    interactState,
    intl,
    resetForm,
    sendTxStartTime,
    openExplorerTxUrl,
    getExplorerTxUrl,
    asset,
    amountToSend,
    network
  ])

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
      case InteractType.Bond:
        return intl.formatMessage({ id: 'deposit.interact.actions.bond' })
      case InteractType.Unbond:
        return intl.formatMessage({ id: 'deposit.interact.actions.unbond' })
      case InteractType.Leave:
        return intl.formatMessage({ id: 'deposit.interact.actions.leave' })
      case InteractType.Custom:
        return intl.formatMessage({ id: 'wallet.action.send' })
      case InteractType.Whitelist:
        return whitelisting
          ? intl.formatMessage({ id: 'deposit.interact.actions.whitelist' })
          : intl.formatMessage({ id: 'common.remove' })
      case InteractType.CacaoPool: {
        const label =
          cacaoPoolAction === Action.add
            ? intl.formatMessage({ id: 'wallet.action.deposit' })
            : intl.formatMessage({ id: 'deposit.withdraw.sym' })
        return label
      }
      case InteractType.MAYAName:
        if (isOwner) {
          return intl.formatMessage({ id: 'common.isUpdateMayaname' })
        } else {
          return intl.formatMessage({ id: 'deposit.interact.actions.buyMayaname' })
        }
    }
  }, [interactType, intl, isOwner, whitelisting, cacaoPoolAction])

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        feeRD,
        RD.map((fee) => {
          return [{ asset: AssetCacao, amount: fee }]
        })
      ),
    [feeRD]
  )

  const onWhitelistAddress = useCallback(() => {
    setWhitelisting(!whitelisting)
    getMemo()
  }, [whitelisting, getMemo])

  const handleUnbond = (nodeAddress: string, pool: MayaLpUnits) => {
    const unitsToUnbond = pool.units.toString()
    const asset = assetToString(pool.asset)
    setValue('mayaAddress', nodeAddress)
    setValue('bondLpUnits', unitsToUnbond)
    setValue('assetPool', asset)
    getMemo()
  }

  const handleLearn = useCallback(() => {
    window.apiUrl.openExternal('https://docs.mayaprotocol.com/mayachain-dev-docs/concepts/transaction-memos')
  }, [])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    setValue('amount', baseToAsset(_amountToSend).amount())
  }, [_amountToSend, setValue])

  const mayaNamefees: UIFeesRD = useMemo(() => {
    const fees: UIFees = [{ asset: AssetCacao, amount: _amountToSend }]
    return RD.success(fees)
  }, [_amountToSend])

  // Reset values whenever interactType has been changed (an user clicks on navigation tab)
  useEffect(() => {
    resetForm()
    setMemo('')
  }, [interactType, resetForm])

  // Reset form when switching between deposit and withdraw for CacaoPool
  useEffect(() => {
    if (interactType === InteractType.CacaoPool) {
      resetForm()
      setMemo('')
    }
  }, [cacaoPoolAction, resetForm, interactType])

  // Call estimate handler when mayaname becomes available
  useEffect(() => {
    if (mayanameAvailable && interactType === InteractType.MAYAName) {
      estimateMayanameHandler()
    }
  }, [mayanameAvailable, interactType, estimateMayanameHandler])

  // Updated renderPoolShares
  const renderPoolShares = useMemo(() => {
    return FP.pipe(
      poolShares,
      RD.fold(
        // Initial state
        () => (
          <div className="py-4">
            <div className="font-main text-[12px] text-gray1 dark:text-gray1d">
              {intl.formatMessage({ id: 'common.initial' })}
            </div>
          </div>
        ),
        // Pending state
        () => (
          <div className="py-4">
            <div className="font-main text-[12px] text-gray1 dark:text-gray1d">
              {intl.formatMessage({ id: 'common.loading' })}
            </div>
          </div>
        ),
        // Failure state
        (error) => (
          <div className="py-4">
            <div className="font-main text-[12px] text-error0 dark:text-error0d">
              {intl.formatMessage({ id: 'common.error' })}: {error.message}
            </div>
          </div>
        ),
        // Success state
        (shares) => (
          <div className="py-4">
            <h3 className="font-mainBold text-[16px] text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.nav.poolshares' })}
            </h3>
            {shares.length === 0 ? (
              <div className="font-main text-[12px] text-gray1 dark:text-gray1d">
                {intl.formatMessage({ id: 'common.noResult' })}
              </div>
            ) : (
              shares.map((share) => (
                <PoolShareItem
                  key={`${assetToString(share.asset)}-${share.units.toString()}`}
                  share={share}
                  isLoading={isLoading}
                  setValue={setValue}
                  getMemo={getMemo}
                />
              ))
            )}
          </div>
        )
      )
    )
  }, [poolShares, intl, isLoading, setValue, getMemo])

  const [showDetails, setShowDetails] = useState<boolean>(true)

  const exampleMemos = [
    { type: 'Bond', memo: 'BOND:ASSET:LPUNITS:NODEADDRESS' },
    { type: 'Unbond', memo: 'UNBOND:ASSET:LPUNITS:NODEADDRESS' },
    { type: 'Leave', memo: 'LEAVE:NODEADDRESS' },
    { type: 'Whitelist Bond Provider', memo: 'BOND:::NODE_ADDRESS:BOND_PROVIDER_ADDRESS:FEE' },
    { type: 'Unwhitelist Bond Provider', memo: 'UNBOND:::NODE_ADDRESS:BOND_PROVIDER_ADDRESS' },
    { type: 'Add LP Symmetrical', memo: '+:POOL:PAIREDADDR' },
    { type: 'Withdraw Lp', memo: 'WITHDRAW:POOL:10000' }
  ]

  const onSubmit = () => {
    setShowConfirmationModal(true)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col space-y-2">
        {/* Memo input (CUSTOM only) */}
        {interactType === InteractType.Custom && (
          <div className="w-full sm:max-w-[630px]">
            <Label color="input" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'common.memo' })}
            </Label>
            <div>
              <Input
                {...register('memo', {
                  required:
                    interactType === InteractType.Custom
                      ? intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
                      : false,
                  onChange: (e) => {
                    setCurrentMemo(e.target.value)
                  }
                })}
                disabled={isLoading}
                size="large"
              />
              {errors.memo && <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.memo.message}</div>}
            </div>
            {/* Display example memos */}
            <div className="mt-4">
              <Label color="input" size="big" textTransform="uppercase">
                {intl.formatMessage({ id: 'common.examples' }, { name: 'Memos' })}
              </Label>
              <div className="rounded-lg bg-gray0 p-4 dark:bg-gray0d">
                {exampleMemos.map((example, index) => (
                  <div
                    key={index}
                    className="mb-2 flex items-center justify-between text-[12px] text-text2 dark:text-text2d">
                    <span className="font-mainBold">{example.type}:</span>
                    <span className="font-main">{example.memo}</span>
                  </div>
                ))}
                <div className="flex justify-end border-t border-solid border-gray2/50 pt-2 dark:border-gray2d/50">
                  <span
                    className="cursor-pointer rounded-full bg-turquoise px-2 text-[12px] text-white"
                    onClick={handleLearn}>
                    Learn More...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {interactType === InteractType.Whitelist && (
          <div className="mb-2 flex items-center justify-end space-x-2">
            <span className="dark:text=text2d text-14 text-text2">Toggle Whitelist / Unwhitelist</span>
            <SwitchButton active={whitelisting} onChange={onWhitelistAddress} />
          </div>
        )}

        {/* Node address input (BOND/UNBOND/LEAVE only) */}
        {(interactType === InteractType.Bond ||
          interactType === InteractType.Unbond ||
          interactType === InteractType.Whitelist ||
          interactType === InteractType.Leave) && (
          <div className="w-full sm:max-w-[630px]">
            <Label color="input" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'common.nodeAddress' })}
            </Label>
            <div>
              <Input
                {...register('mayaAddress', {
                  required:
                    interactType === InteractType.Bond ||
                    interactType === InteractType.Unbond ||
                    interactType === InteractType.Whitelist ||
                    interactType === InteractType.Leave
                      ? intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
                      : false,
                  validate: addressValidator,
                  onChange: () => getMemo()
                })}
                disabled={isLoading}
                size="large"
              />
              {errors.mayaAddress && (
                <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.mayaAddress.message}</div>
              )}
            </div>
          </div>
        )}

        {/** Cacao Pool */}
        {interactType === InteractType.CacaoPool && (
          <div className="mb-2">
            <span className="inline-block">
              <Switch
                labels={['DEPOSIT', 'WITHDRAW']}
                colors={['#3B82F6', '#EF4444']}
                onChange={(value) => {
                  setCacaoPoolAction(value === 'DEPOSIT' ? Action.add : Action.withdraw)
                }}
              />
            </span>
          </div>
        )}
        {/* Provider address input (whitelist only) */}
        {interactType === InteractType.Whitelist && (
          <>
            <div className="w-full sm:max-w-[630px]">
              <Label color="input" size="big" textTransform="uppercase">
                {intl.formatMessage({ id: 'common.providerAddress' })}
              </Label>
              <div>
                <Input
                  {...register('providerAddress', {
                    required:
                      interactType === InteractType.Whitelist
                        ? intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
                        : false,
                    validate: addressValidator,
                    onChange: () => getMemo()
                  })}
                  disabled={isLoading}
                  size="large"
                />
                {errors.providerAddress && (
                  <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.providerAddress.message}</div>
                )}
              </div>
            </div>
            <div className="w-full sm:max-w-[630px]">
              <Label color="input" size="big" textTransform="uppercase">
                {intl.formatMessage({ id: 'common.fee.nodeOperator' })}
              </Label>
              <div>
                <Input
                  {...register('operatorFee', {
                    onChange: () => getMemo()
                  })}
                  placeholder="Enter a % value, memo will populate with Basis Points automatically"
                  disabled={isLoading}
                  size="large"
                />
                {errors.operatorFee && (
                  <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.operatorFee.message}</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Amount input (BOND/UNBOND/CUSTOM only) */}
        {(interactType === InteractType.Custom || interactType === InteractType.CacaoPool) && (
          <div className="w-full sm:max-w-[630px]">
            <Label color="input" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'common.amount' })}
            </Label>
            <div>
              <Controller
                name="amount"
                control={control}
                rules={{
                  required:
                    interactType === InteractType.Custom
                      ? intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
                      : false,
                  validate: amountValidator
                }}
                render={({ field }) => (
                  <InputBigNumber
                    {...field}
                    disabled={isLoading}
                    size="large"
                    decimal={CACAO_DECIMAL}
                    onChange={(value) => {
                      field.onChange(value)
                      // Skip onChangeInput for CacaoPool withdrawals to avoid precision loss
                      if (!(interactType === InteractType.CacaoPool && cacaoPoolAction === Action.withdraw)) {
                        onChangeInput(value)
                      }
                    }}
                  />
                )}
              />
              {errors.amount && (
                <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.amount.message}</div>
              )}
            </div>
            {/* max. amount button (BOND/CUSTOM only) */}
            {(interactType === InteractType.Custom || interactType === InteractType.CacaoPool) && (
              <MaxBalanceButton
                className="mb-10px"
                color="neutral"
                balance={{ amount: maxAmount, asset: asset }}
                maxDollarValue={maxAmountPriceValue}
                onClick={() => {
                  if (interactType === InteractType.CacaoPool && cacaoPoolAction === Action.withdraw) {
                    // Use exact provider value to avoid precision loss
                    addMaxAmountHandler(cacaoPoolProvider.value)
                  } else {
                    addMaxAmountHandler(maxAmount)
                  }
                }}
                disabled={isLoading}
                onChange={() => getMemo()}
              />
            )}
          </div>
        )}
        {(interactType === InteractType.Bond || interactType === InteractType.Unbond) && (
          <>
            {userNodeInfo ? (
              <div className="p-4">
                <div className="ml-[-2px] flex w-full justify-between font-mainBold text-[14px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage({ id: 'common.nodeAddress' })}
                  <div className="truncate pl-10px font-main text-[12px]">{userNodeInfo.nodeAddress}</div>
                </div>
                <div className="ml-[-2px] flex w-full justify-between font-mainBold text-[14px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage({ id: 'common.address.self' })}
                  <div className="truncate pl-10px font-main text-[12px]">{walletAddress}</div>
                </div>
                <div className="mt-2">
                  <div className="pl-10px">
                    {userNodeInfo.pools.length > 0 ? (
                      <table className="w-full border-collapse text-[12px] text-gray1 dark:text-gray1d">
                        <thead>
                          <tr className="border-b border-gray1 dark:border-gray1d">
                            <th className="p-2 text-left">{intl.formatMessage({ id: 'common.pool' })}</th>
                            <th className="p-2 text-left">{intl.formatMessage({ id: 'deposit.share.units' })}</th>
                            <th className="p-2 text-left">{intl.formatMessage({ id: 'common.action' })}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userNodeInfo.pools.map((pool, index) => {
                            const assetString = assetToString(pool.asset)
                            return (
                              <tr key={index} className="border-b border-gray1 last:border-0 dark:border-gray1d">
                                <td className="p-2">{assetString}</td>
                                <td className="p-2">{pool.units.toString()}</td>
                                <td className="p-2">
                                  <FlatButton
                                    size="small"
                                    onClick={() => handleUnbond(userNodeInfo.nodeAddress, pool)}
                                    disabled={isLoading || interactType === InteractType.Bond}>
                                    {intl.formatMessage({ id: 'deposit.interact.actions.unbond' })}
                                  </FlatButton>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-[12px] text-gray1 dark:text-gray1d">
                        {intl.formatMessage({ id: 'common.noResult' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-2 ml-[-2px] flex w-full justify-between font-mainBold text-[14px] text-gray2 dark:text-gray2d">
                {intl.formatMessage({ id: 'deposit.share.units' })}
                <div className="truncate pl-10px font-main text-[12px]">
                  {intl.formatMessage({ id: 'common.noResult' })}
                </div>
              </div>
            )}
          </>
        )}

        {interactType === InteractType.Bond && renderPoolShares}
        {interactType !== InteractType.MAYAName && (
          <Fees className="pb-5" fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
        )}
        {isFeeError && renderFeeError}

        {/* Mayaname Button and Details*/}
        {interactType === InteractType.MAYAName && (
          <div className="w-full sm:max-w-[630px]">
            <div className="flex w-full items-center text-[12px]">
              <Label color="input" size="big" textTransform="uppercase">
                {intl.formatMessage({ id: 'common.mayaname' })}
              </Label>
              <InfoIcon
                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                color="primary"
                tooltip={intl.formatMessage({ id: 'common.mayanameRegistrationSpecifics' })}
              />
            </div>

            <div>
              <Input
                {...register('mayaname', {
                  required:
                    interactType === InteractType.MAYAName
                      ? intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
                      : false,
                  onChange: () => mayanameHandler()
                })}
                disabled={isLoading}
                size="large"
              />
              {errors.mayaname && (
                <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.mayaname.message}</div>
              )}
            </div>
            {O.isSome(oMayaname) && !mayanameAvailable && !isOwner && renderMayanameError}
          </div>
        )}
        {/** Form item for unregistered mayaname */}
        {mayanameAvailable && (
          <div className="w-full sm:max-w-[630px]">
            {isOwner ? (
              <CheckButton
                checked={mayanameUpdate || isOwner}
                clickHandler={() => setMayanameUpdate(true)}
                disabled={isLoading}>
                {intl.formatMessage({ id: 'common.isUpdateMayaname' })}
              </CheckButton>
            ) : (
              <></>
            )}
            {!mayanameRegister ? (
              <>
                {/* Add input fields for aliasChain, aliasAddress, and expiry */}
                <Label color="input" size="big" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.aliasChain' })}
                </Label>
                <div>
                  <Controller
                    name="aliasChain"
                    control={control}
                    rules={{
                      required: interactType === InteractType.MAYAName ? 'Please provide an alias chain.' : false
                    }}
                    render={({ field }) => (
                      <RadioGroup
                        {...field}
                        value={aliasChain}
                        onChange={(value) => {
                          field.onChange(value)
                          handleRadioChainChange(value)
                          estimateMayanameHandler()
                        }}>
                        <Radio className="text-gray2 dark:text-gray2d" value={AssetAETH.chain}>
                          ARB
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value={AssetBTC.chain}>
                          BTC
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value={AssetETH.chain}>
                          ETH
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value={AssetRuneNative.chain}>
                          RUNE
                        </Radio>
                      </RadioGroup>
                    )}
                  />
                  {errors.aliasChain && (
                    <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.aliasChain.message}</div>
                  )}
                </div>
                <Label color="input" size="big" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.aliasAddress' })}
                </Label>
                <div>
                  <Input
                    {...register('aliasAddress', {
                      required: interactType === InteractType.MAYAName ? 'Please provide an alias address.' : false,
                      onChange: () => estimateMayanameHandler()
                    })}
                    disabled={isLoading}
                    size="large"
                  />
                  {errors.aliasAddress && (
                    <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.aliasAddress.message}</div>
                  )}
                </div>
                <Label color="input" size="big" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.expiry' })}
                </Label>
                <div>
                  <Controller
                    name="expiry"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        {...field}
                        onChange={(value) => {
                          field.onChange(value)
                          estimateMayanameHandler()
                        }}>
                        <Radio className="text-gray2 dark:text-gray2d" value="1">
                          1 year
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value="2">
                          2 years
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value="3">
                          3 years
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value="5">
                          5 years
                        </Radio>
                      </RadioGroup>
                    )}
                  />
                  {errors.expiry && (
                    <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.expiry.message}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Initial values needed for tns or mns register */}
                <Label color="input" size="big" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.aliasChain' })}
                </Label>
                <div>
                  <Controller
                    name="chain"
                    control={control}
                    rules={{
                      required: interactType === InteractType.MAYAName ? 'Please provide an alias chain.' : false
                    }}
                    render={({ field }) => (
                      <RadioGroup
                        {...field}
                        onChange={(value) => {
                          field.onChange(value)
                          estimateMayanameHandler()
                        }}>
                        <Radio className="text-gray2 dark:text-gray2d" value={AssetCacao.chain}>
                          MAYA
                        </Radio>
                      </RadioGroup>
                    )}
                  />
                  {errors.chain && (
                    <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.chain.message}</div>
                  )}
                </div>
                <Label color="input" size="big" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.aliasAddress' })}
                </Label>
                <div>
                  <Input
                    {...register('chainAddress', {
                      required: interactType === InteractType.MAYAName ? 'Please provide an alias address.' : false,
                      onChange: () => estimateMayanameHandler()
                    })}
                    disabled={isLoading}
                    size="large"
                  />
                  {errors.chainAddress && (
                    <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.chainAddress.message}</div>
                  )}
                </div>
                <Label color="input" size="big" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.expiry' })}
                </Label>
                <div>
                  <Controller
                    name="expiry"
                    control={control}
                    rules={{
                      required: interactType === InteractType.MAYAName ? true : false
                    }}
                    render={({ field }) => (
                      <RadioGroup
                        {...field}
                        onChange={(value) => {
                          field.onChange(value)
                          estimateMayanameHandler()
                        }}>
                        <Radio className="text-gray2 dark:text-gray2d" value="1">
                          1 year
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value="2">
                          2 years
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value="3">
                          3 years
                        </Radio>
                        <Radio className="text-gray2 dark:text-gray2d" value="5">
                          5 years
                        </Radio>
                      </RadioGroup>
                    )}
                  />
                  {errors.expiry && (
                    <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.expiry.message}</div>
                  )}
                </div>
              </>
            )}
            <Fees className="mt-10px pb-5" fees={mayaNamefees} disabled={isLoading} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-center">
        {mayanameQuoteValid && (
          <FlatButton
            className="mt-10px min-w-[200px]"
            loading={isLoading}
            disabled={isLoading}
            type="submit"
            size="large">
            {submitLabel}
          </FlatButton>
        )}

        {interactType === InteractType.CacaoPool && (
          <FlatButton
            className="mt-20px min-w-[200px]"
            loading={isLoading}
            disabled={
              isLoading ||
              !cacaoPoolAvailable ||
              (cacaoPoolAction === Action.withdraw &&
                cacaoPoolData &&
                RD.isSuccess(cacaoPoolData) &&
                cacaoPoolData.value.blocksLeft > 0)
            }
            type="submit"
            size="large">
            {submitLabel}
          </FlatButton>
        )}

        {interactType !== InteractType.CacaoPool && interactType !== InteractType.MAYAName && (
          <FlatButton
            className="mt-10px min-w-[200px]"
            loading={isLoading}
            disabled={isLoading}
            type="submit"
            size="large">
            {submitLabel}
          </FlatButton>
        )}
      </div>
      <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
        {/* memo */}
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
            <>
              {FP.pipe(
                oMayaname,
                O.map(({ owner, expireBlockHeight, aliases }) => {
                  if (owner || expireBlockHeight || aliases) {
                    return (
                      <>
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          {intl.formatMessage({ id: 'common.owner' })}
                          <div>{owner}</div>
                        </div>
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div>{intl.formatMessage({ id: 'common.expirationBlock' })}</div>
                          <div>{expireBlockHeight}</div>
                        </div>

                        {aliases &&
                          aliases.map((alias, index) => (
                            <div key={index}>
                              <div className="flex w-full justify-between pl-10px text-[12px]">
                                {intl.formatMessage({ id: 'common.aliasChain' })}
                                <div>{alias.chain}</div>
                              </div>
                              <div className="flex w-full justify-between pl-10px text-[12px]">
                                {intl.formatMessage({ id: 'common.aliasAddress' })}
                                <div>{alias.address}</div>
                              </div>
                            </div>
                          ))}
                      </>
                    )
                  }
                  return null
                }),
                O.toNullable
              )}
              {interactType === InteractType.CacaoPool && (
                <>
                  <div className="ml-[-2px] flex w-full justify-between pt-10px font-mainBold text-[14px]">
                    {intl.formatMessage({ id: 'protocolPool.detail.daysLeft' })}
                    <div className="truncate pl-10px font-main text-[12px]">
                      {RD.fold(
                        () => <p>{emptyString}</p>,
                        () => <p>{emptyString}</p>,
                        (error: Error) => (
                          <p>
                            {intl.formatMessage({ id: 'common.error' })}: {error.message}
                          </p>
                        ),
                        (data: { daysLeft: number; blocksLeft: number }) => (
                          <div>
                            <p>
                              {intl.formatMessage({ id: 'common.time.days' }, { days: `${data.daysLeft.toFixed(1)}` })}
                            </p>
                          </div>
                        )
                      )(cacaoPoolData)}
                    </div>
                  </div>
                </>
              )}
              <div className="ml-[-2px] flex w-full justify-between pt-10px font-mainBold text-[14px]">
                {intl.formatMessage({ id: 'common.amount' })}
                <div className="truncate pl-10px font-main text-[12px]">
                  {formatAssetAmountCurrency({
                    amount: baseToAsset(_amountToSend), // Find the value of swap slippage
                    asset: AssetCacao,
                    decimal: isUSDAsset(AssetCacao) ? 2 : 6,
                    trimZeros: !isUSDAsset(AssetCacao)
                  })}
                </div>
              </div>

              <div className="ml-[-2px] flex w-full justify-between pt-10px font-mainBold text-[14px]">
                {intl.formatMessage({ id: 'common.memo' })}
                <div className="overflow break-normal pl-10px font-main text-[12px]">{memoLabel}</div>
              </div>
            </>
          )}
        </div>
      </div>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </form>
  )
}

const PoolShareItem = ({
  share,
  isLoading,
  setValue,
  getMemo
}: {
  share: PoolShare
  isLoading: boolean
  setValue: (name: keyof FormValues, value: string | number | BigNumber) => void
  getMemo: () => string
}) => {
  const [mode, setMode] = useState<'half' | 'max' | 'custom'>('max')
  const [customPercentage, setCustomPercentage] = useState<string>('') // Add state for percentage
  const intl = useIntl()
  const { network } = useNetwork()
  const assetString = assetToString(share.asset)
  const bondableAssets = useBondableAssets()
  const isBondable = bondableAssets.includes(assetString)

  const handleBondClick = (unitsToBond: string, asset: string) => {
    setValue('bondLpUnits', unitsToBond)
    setValue('assetPool', asset)
    getMemo()
  }

  const handleHalfClick = () => {
    setMode('half')
    const halfUnits = share.units.div(2).toFixed(0)
    handleBondClick(halfUnits, assetString)
  }

  const handleMaxClick = () => {
    setMode('max')
    handleBondClick(share.units.toString(), assetString)
  }

  const handleCustomClick = () => {
    setMode('custom')
    setCustomPercentage('')
  }

  const handleCustomPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || (/^\d*\.?\d*$/.test(value) && parseFloat(value) <= 100)) {
      setCustomPercentage(value)

      if (value !== '') {
        const percentage = parseFloat(value)
        const unitsToBond = share.units.times(percentage).div(100).toFixed(0)
        handleBondClick(unitsToBond, assetString)
      }
    }
  }

  return (
    <div className="flex flex-col border-b pb-2 pt-2 first:pt-0 dark:border-gray1d">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AssetIcon asset={share.asset} network={network} />
          <div className="flex flex-col">
            <div className="font-main text-[12px] text-text2 dark:text-text2d">{assetString}</div>
            <div className="font-main text-[10px] text-gray1 dark:text-gray1d">
              {`${intl.formatMessage({ id: 'pools.bondable' })} : ${
                bondableAssets.length === 0 ? intl.formatMessage({ id: 'common.loading' }) : isBondable ? 'Yes' : 'No'
              }`}
            </div>
            <div className="font-main text-[10px] text-gray1 dark:text-gray1d">
              {`${intl.formatMessage({ id: 'deposit.share.units' })} : ${share.units.toString()}`}
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <FlatButton
            size="small"
            onClick={handleHalfClick}
            disabled={isLoading || bondableAssets.length === 0 || !isBondable}>
            {intl.formatMessage({ id: 'common.half' })}
          </FlatButton>
          <FlatButton
            size="small"
            onClick={handleMaxClick}
            disabled={isLoading || bondableAssets.length === 0 || !isBondable}>
            {intl.formatMessage({ id: 'common.max' })}
          </FlatButton>
          <FlatButton
            size="small"
            onClick={handleCustomClick}
            disabled={isLoading || bondableAssets.length === 0 || !isBondable}>
            {intl.formatMessage({ id: 'common.custom' })}
          </FlatButton>
        </div>
      </div>

      {mode === 'custom' && (
        <div className="mt-2">
          <Input
            size="small"
            disabled={isLoading || bondableAssets.length === 0 || !isBondable}
            value={customPercentage}
            onChange={handleCustomPercentageChange}
            placeholder="Enter percentage (0-100)"
          />
          {customPercentage && (parseFloat(customPercentage) <= 0 || parseFloat(customPercentage) > 100) && (
            <div className="mt-1 text-sm text-error0 dark:text-error0d">Percentage must be between 0 and 100</div>
          )}
        </div>
      )}
    </div>
  )
}
