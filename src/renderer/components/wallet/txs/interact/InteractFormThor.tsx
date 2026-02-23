import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon
} from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import {
  assetAmount,
  assetToBase,
  baseAmount,
  BaseAmount,
  baseToAsset,
  bn,
  CryptoAmount,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { either as E, function as FP, option as O } from 'fp-ts'
import { useForm, Controller } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { ONE_RUNE_BASE_AMOUNT } from '../../../../../shared/mock/amount'
import { AssetRuneNative } from '../../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { THORCHAIN_DECIMAL, isUSDAsset } from '../../../../helpers/assetHelper'
import { validateAddress } from '../../../../helpers/form/validation'
import {
  Action,
  getBondMemo,
  getLeaveMemo,
  getProtocolPoolMemo,
  getUnbondMemo,
  getWhitelistMemo
} from '../../../../helpers/memoHelper'
import { getPoolPriceValue } from '../../../../helpers/poolHelper'
import { emptyString } from '../../../../helpers/stringHelper'
import { useMimirConstants } from '../../../../hooks/useMimirConstants'
import { usePricePool } from '../../../../hooks/usePricePool'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../services/clients'
import { INITIAL_INTERACT_STATE } from '../../../../services/thorchain/const'
import {
  InteractState,
  InteractStateHandler,
  LastblockItem,
  NodeInfos,
  NodeInfosRD,
  RunePoolProvider,
  RunePoolProviderRD,
  ThorchainLastblockRD
} from '../../../../services/thorchain/types'
import { ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { TxModal } from '../../../modal/tx'
import { SendAsset } from '../../../modal/tx/extra/SendAsset'
import { BaseButton, FlatButton, ViewTxButton } from '../../../uielements/button'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { SwitchButton } from '../../../uielements/button/SwitchButton'
import { Fees, UIFees, UIFeesRD } from '../../../uielements/fees'
import { Input, InputBigNumber } from '../../../uielements/input'
import { Label } from '../../../uielements/label'
import { Tooltip } from '../../../uielements/tooltip'
import { validateTxAmountInput } from '../TxForm.util'
import * as H from './Interact.helpers'
import { InteractType } from './Interact.types'
import { THORNameForm } from './thorname/THORNameForm'

type FormValues = {
  memo: string
  thorAddress: string
  providerAddress: string
  operatorFee: number
  amount: BigNumber
}
type UserNodeInfo = {
  nodeAddress: string
  bondProviderAddress?: string
  bondAmount?: BaseAmount
  isNodeOperatorAddress: boolean
}

type Props = {
  interactType: InteractType
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  balance: WalletBalance
  interact$: InteractStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  fee: FeeRD
  reloadFeesHandler: FP.Lazy<void>
  addressValidation: AddressValidation
  validatePassword$: ValidatePasswordHandler
  thorchainQuery: ThorchainQuery
  network: Network
  poolDetails: PoolDetails
  nodes: NodeInfosRD
  runePoolProvider: RunePoolProviderRD
  thorchainLastblock: ThorchainLastblockRD
}

export const InteractFormThor = ({
  interactType,
  poolDetails,
  balance,
  walletType,
  hdMode,
  walletIndex,
  walletAccount,
  interact$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  addressValidation,
  fee: feeRD,
  reloadFeesHandler,
  validatePassword$,
  thorchainQuery,
  network,
  nodes: nodesRD,
  runePoolProvider: runePoolProviderRd,
  thorchainLastblock: thorchainLastblockRd
}: Props) => {
  const intl = useIntl()

  const { asset } = balance

  const { walletAddress } = balance
  const pricePool = usePricePool()
  const mimirKeys = useMimirConstants(['RUNEPOOLDEPOSITMATURITYBLOCKS', 'RUNEPOOLENABLED'])

  const [hasProviderAddress, setHasProviderAddress] = useState(false)

  const [userNodeInfo, setUserNodeInfo] = useState<UserNodeInfo | undefined>(undefined)
  const [_amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const [runePoolAction, setRunePoolAction] = useState<Action>(Action.add)
  const [whitelisting, setWhitelisting] = useState<boolean>(true)

  const nodes: NodeInfos = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.getOrElse(() => [] as NodeInfos)
      ),
    [nodesRD]
  )
  const runePoolProvider: RunePoolProvider = useMemo(() => {
    const defaultRunePoolProvider: RunePoolProvider = {
      address: '',
      value: baseAmount(0),
      pnl: baseAmount(0),
      depositAmount: baseAmount(0),
      withdrawAmount: baseAmount(0),
      addHeight: O.none,
      withdrawHeight: O.none,
      walletType: undefined
    }

    if (!runePoolProviderRd) {
      return defaultRunePoolProvider
    }

    return FP.pipe(
      runePoolProviderRd,
      RD.getOrElse(() => defaultRunePoolProvider)
    )
  }, [runePoolProviderRd])

  const useRunePoolProviderMaturity = (
    runePoolProviderRd: RD.RemoteData<Error, { addHeight: O.Option<number> }>,
    thorchainLastblockRd: RD.RemoteData<Error, Pick<LastblockItem, 'chain' | 'thorchain'>[]>,
    mimirKeys: { [key: string]: number }
  ) => {
    return useMemo(() => {
      return FP.pipe(
        RD.combine(runePoolProviderRd, thorchainLastblockRd),
        RD.chain(([runePoolProvider, lastblocks]) => {
          return FP.pipe(
            runePoolProvider.addHeight,
            O.fold(
              () => RD.failure(new Error('addHeight is not available')),
              (addHeight) => {
                const thorchainBlock = lastblocks.find((block) => block.thorchain)
                return thorchainBlock
                  ? RD.success({
                      addHeight,
                      lastBlock: thorchainBlock.thorchain,
                      runePoolMimir: mimirKeys['RUNEPOOLDEPOSITMATURITYBLOCKS']
                    })
                  : RD.failure(new Error('Thorchain block not found'))
              }
            )
          )
        }),
        RD.map(({ addHeight, lastBlock, runePoolMimir }) => {
          return H.getBlocksLeft(lastBlock, addHeight, runePoolMimir)
        })
      )
    }, [runePoolProviderRd, thorchainLastblockRd, mimirKeys])
  }

  const runePoolData = useRunePoolProviderMaturity(runePoolProviderRd, thorchainLastblockRd, mimirKeys)
  const runePoolAvailable = mimirKeys['RUNEPOOLENABLED'] === 1

  useEffect(() => {
    let foundNodeInfo: UserNodeInfo | undefined = undefined

    for (const node of nodes) {
      const normalizedNodeOperatorAddress = node.nodeOperatorAddress.toLowerCase()
      const normalizedWalletAddress = walletAddress.toLowerCase()

      // Check if the wallet address matches the node address
      const isNodeOperatorAddress = normalizedNodeOperatorAddress === normalizedWalletAddress

      // Check if the wallet address matches any bond provider address
      const matchingProvider = node.bondProviders.providers.find(
        (provider) => normalizedWalletAddress === provider.bondAddress.toLowerCase()
      )

      if (isNodeOperatorAddress || matchingProvider) {
        foundNodeInfo = {
          nodeAddress: node.address,
          isNodeOperatorAddress,
          bondProviderAddress: matchingProvider?.bondAddress,
          bondAmount: matchingProvider?.bond
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
      case InteractType.Custom:
        return _amountToSend
      case InteractType.Whitelist:
        return ONE_RUNE_BASE_AMOUNT
      case InteractType.Leave:
      case InteractType.Unbond:
        return ZERO_BASE_AMOUNT
      case InteractType.RunePool: {
        const amnt = runePoolAction === Action.add ? _amountToSend : ZERO_BASE_AMOUNT
        return amnt
      }
      case InteractType.CacaoPool: {
        return ZERO_BASE_AMOUNT
      }
      default:
        return ZERO_BASE_AMOUNT
    }
  }, [_amountToSend, interactType, runePoolAction])

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
    formState: { errors, isValid }
  } = useForm<FormValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      memo: '',
      thorAddress: '',
      providerAddress: '',
      operatorFee: 0,
      amount: bn(0)
    }
  })

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  const [currentMemo, setCurrentMemo] = useState('')

  const isFeeError = useMemo(
    () =>
      FP.pipe(
        oFee,
        O.fold(
          () => false,
          (fee) => balance.amount.amount().isLessThan(fee.amount())
        )
      ),
    [balance, oFee]
  )

  const handleMemo = useCallback(() => {
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
              asset: AssetRuneNative,
              trimZeros: true
            })
          }
        )}
      </Label>
    ),
    [intl, balance.amount]
  )

  const renderRunePoolWarning = useMemo(
    () => (
      <Label size="big" color="warning">
        {intl.formatMessage({ id: 'protocolPool.detail.warning' })}
      </Label>
    ),
    [intl]
  )

  // max amount for RuneNative
  const maxAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oFee,
        O.fold(
          () => ZERO_BASE_AMOUNT,
          (fee) => {
            if (interactType === InteractType.Unbond) {
              let maxAmountBalOrBond: BaseAmount = ZERO_BASE_AMOUNT
              maxAmountBalOrBond = userNodeInfo?.bondAmount ? userNodeInfo.bondAmount : ZERO_BASE_AMOUNT
              return maxAmountBalOrBond
            } else if (interactType === InteractType.RunePool && runePoolAction === Action.withdraw) {
              return runePoolProvider.value.gt(0) ? runePoolProvider.value : ZERO_BASE_AMOUNT
            } else {
              // For other interaction types, use the balance amount
              return balance.amount.minus(fee.plus(ONE_RUNE_BASE_AMOUNT))
            }
          }
        )
      ),
    [oFee, interactType, runePoolAction, userNodeInfo, runePoolProvider, balance.amount]
  )

  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(maxAmount, asset)) // Initial state can be null or a suitable default

  useEffect(() => {
    const maxAmountPrice = getPoolPriceValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool
    })

    if (
      interactType === InteractType.Bond ||
      interactType === InteractType.Custom ||
      interactType === InteractType.RunePool
    ) {
      if (O.isSome(maxAmountPrice)) {
        const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
        setMaxAmountPriceValue(maxCryptoAmount)
      }
    }
  }, [asset, interactType, maxAmount, network, poolDetails, pricePool])

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
          case InteractType.RunePool:
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

  const addMaxAmountHandler = useCallback(
    (maxAmount: BaseAmount) => {
      setAmountToSend(maxAmount)
    },
    [setAmountToSend]
  )

  const addressValidator = useCallback(
    async (value: string) => {
      const inputAddres = value.toLowerCase()
      const nodeIndex = H.findNodeIndex(nodes, inputAddres)
      if (interactType === InteractType.Unbond && nodeIndex > -1) {
        return intl.formatMessage({ id: 'bonds.validations.bondStatusActive' })
      }
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
    [addressValidation, interactType, intl, nodes]
  )

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const getMemo = useCallback(() => {
    const thorAddress = watch('thorAddress')
    const whitelistAdd = watch('providerAddress')
    const nodeOperatorFee = watch('operatorFee')
    const feeInBasisPoints = nodeOperatorFee ? nodeOperatorFee * 100 : undefined

    let createMemo = ''
    switch (interactType) {
      case InteractType.Bond: {
        createMemo = getBondMemo(thorAddress)
        break
      }
      case InteractType.Unbond: {
        createMemo = getUnbondMemo(thorAddress, _amountToSend)
        break
      }
      case InteractType.Whitelist: {
        createMemo = getWhitelistMemo(whitelisting, THORChain, thorAddress, whitelistAdd, feeInBasisPoints)
        break
      }
      case InteractType.Leave: {
        createMemo = getLeaveMemo(thorAddress)
        break
      }
      case InteractType.RunePool: {
        createMemo = getProtocolPoolMemo({
          action: runePoolAction,
          bps: H.getProtocolPoolWithdrawBps(runePoolProvider.value, _amountToSend),
          network
        })
        break
      }
      case InteractType.Custom: {
        createMemo = currentMemo
        break
      }
    }
    setMemo(createMemo)
    return createMemo
  }, [
    _amountToSend,
    currentMemo,
    watch,
    interactType,
    memo,
    network,
    runePoolAction,
    runePoolProvider.value,
    whitelisting
  ])

  const onChangeInput = useCallback(
    (value: BigNumber) => {
      // Update the amount to send state for memo generation
      const newAmountToSend = assetToBase(assetAmount(value, THORCHAIN_DECIMAL))
      setAmountToSend(newAmountToSend)
      // Let react-hook-form handle validation
    },
    [setAmountToSend]
  )
  useEffect(() => {
    // This code will run after the state has been updated
    getMemo()
  }, [amountToSend, getMemo])

  const submitTx = useCallback(() => {
    setSendTxStartTime(Date.now())

    subscribeInteractState(
      interact$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        amount: amountToSend,
        memo: getMemo(),
        asset: asset
      })
    )
  }, [subscribeInteractState, interact$, walletType, walletAccount, walletIndex, hdMode, amountToSend, getMemo, asset])

  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const resetForm = useCallback(() => {
    resetInteractState()
    reset({
      memo: '',
      thorAddress: watch('thorAddress'), // Keep thorAddress value
      providerAddress: '',
      operatorFee: 0,
      amount: bn(0)
    })
    setHasProviderAddress(false)
    setMemo('')
    setAmountToSend(ZERO_BASE_AMOUNT)
  }, [reset, resetInteractState, watch])

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
          chain={THORChain}
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

    // Get timer value
    const timerValue = FP.pipe(
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
    )
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
            network={network}
          />
        }
        timerValue={timerValue}
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

  const amountLabel = useMemo(() => {
    switch (interactType) {
      case InteractType.Bond:
        return `${intl.formatMessage({ id: 'deposit.interact.actions.bond' })} ${intl.formatMessage({
          id: 'common.amount'
        })}`

      case InteractType.Unbond:
        return `${intl.formatMessage({ id: 'deposit.interact.actions.unbond' })} ${intl.formatMessage({
          id: 'common.amount'
        })}`
      case InteractType.Whitelist:
        return `${intl.formatMessage({ id: 'deposit.interact.actions.whitelist' })} ${intl.formatMessage({
          id: 'common.amount'
        })}`
      case InteractType.Leave:
        return intl.formatMessage({ id: 'deposit.interact.actions.leave' })
      case InteractType.RunePool: {
        return intl.formatMessage({
          id: 'common.amount'
        })
      }
      case InteractType.Custom:
        return `${intl.formatMessage({
          id: 'common.custom'
        })} ${intl.formatMessage({
          id: 'common.amount'
        })}`
    }
  }, [interactType, intl])

  const submitLabel = useMemo(() => {
    switch (interactType) {
      case InteractType.Bond:
        if (hasProviderAddress) {
          return intl.formatMessage({ id: 'deposit.interact.actions.addBondProvider' })
        } else {
          return intl.formatMessage({ id: 'deposit.interact.actions.bond' })
        }
      case InteractType.Unbond:
        return intl.formatMessage({ id: 'deposit.interact.actions.unbond' })
      case InteractType.Leave:
        return intl.formatMessage({ id: 'deposit.interact.actions.leave' })
      case InteractType.Whitelist:
        return whitelisting
          ? intl.formatMessage({ id: 'deposit.interact.actions.whitelist' })
          : intl.formatMessage({ id: 'common.remove' })
      case InteractType.RunePool: {
        const label =
          runePoolAction === Action.add
            ? intl.formatMessage({ id: 'wallet.action.deposit' })
            : intl.formatMessage({ id: 'deposit.withdraw.sym' })
        return label
      }
      case InteractType.Custom:
        return intl.formatMessage({ id: 'wallet.action.send' })
    }
  }, [interactType, hasProviderAddress, intl, whitelisting, runePoolAction])

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        feeRD,
        RD.map((fee) => [
          {
            asset: AssetRuneNative,
            amount: interactType === InteractType.Bond ? fee.plus(ONE_RUNE_BASE_AMOUNT) : fee
          }
        ])
      ),
    [feeRD, interactType]
  )

  const onWhitelistAddress = useCallback(() => {
    setWhitelisting(!whitelisting)
    getMemo()
  }, [whitelisting, getMemo])

  const handleLearn = useCallback(() => {
    window.apiUrl.openExternal('https://dev.thorchain.org/concepts/memos.html')
  }, [])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    setValue('amount', baseToAsset(_amountToSend).amount())
  }, [_amountToSend, setValue])

  // Reset values whenever interactType has been changed (an user clicks on navigation tab)
  useEffect(() => {
    resetForm()
    setMemo('')
    setRunePoolAction(Action.add) // Reset to deposit when changing interact type
  }, [interactType, resetForm])

  // Reset form when switching between deposit and withdraw for RunePool
  useEffect(() => {
    if (interactType === InteractType.RunePool) {
      resetForm()
      setMemo('')
    }
  }, [runePoolAction, resetForm, interactType])

  const [showDetails, setShowDetails] = useState<boolean>(true)
  const bondBaseAmount = userNodeInfo?.bondAmount ? userNodeInfo.bondAmount : baseAmount(0)

  const exampleMemos = [
    { type: 'Stake TCY', memo: 'TCY+' },
    { type: 'Unstake TCY', memo: 'TCY-:BASISPOINTS' },
    { type: 'Bond', memo: 'BOND:NODEADDRESS' },
    { type: 'Unbond', memo: 'UNBOND:NODEADDRESS' },
    { type: 'Leave', memo: 'LEAVE:NODEADDRESS' },
    { type: 'Whitelist Bond Provider', memo: 'BOND:NODEADDRESS:PROVIDERADDRESS:FEE' },
    { type: 'Unwhitelist Bond Provider', memo: 'UNBOND:NODEADDRESS:PROVIDERADDRESS' },
    { type: 'Add LP Symmetrical', memo: 'ADD:POOL:PAIREDADDRESS' },
    { type: 'Withdraw Lp', memo: 'WITHDRAW:POOL:BASISPOINTS' }
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
                  onChange: handleMemo
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
        {/** Rune Pool */}
        {interactType === InteractType.RunePool && (
          <div className="mb-2">
            <div className="flex border-b border-gray0 dark:border-gray0d">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-4 pb-2 font-main text-[14px] transition-colors ${
                  runePoolAction === Action.add
                    ? 'border-b-2 border-turquoise text-turquoise'
                    : 'text-gray2 hover:text-text0 dark:text-gray2d dark:hover:text-text0d'
                }`}
                onClick={() => setRunePoolAction(Action.add)}>
                <ArrowDownTrayIcon className="h-4 w-4" />
                DEPOSIT
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-4 pb-2 font-main text-[14px] transition-colors ${
                  runePoolAction === Action.withdraw
                    ? 'border-b-2 border-error0 text-error0 dark:border-error0d dark:text-error0d'
                    : 'text-gray2 hover:text-text0 dark:text-gray2d dark:hover:text-text0d'
                }`}
                onClick={() => setRunePoolAction(Action.withdraw)}>
                <ArrowUpTrayIcon className="h-4 w-4" />
                WITHDRAW
              </button>
            </div>
            {!runePoolAvailable && (
              <span className="mt-2 inline-block text-[14px]">
                {intl.formatMessage({ id: 'protocolPool.detail.availability' })}
              </span>
            )}
            {runePoolProvider.value.gt(0) && runePoolAction === Action.add && renderRunePoolWarning}
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
                {...register('thorAddress', {
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
              {errors.thorAddress && (
                <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.thorAddress.message}</div>
              )}
            </div>
          </div>
        )}
        {/* Provider address input (whitelist only) */}
        {interactType === InteractType.Whitelist && (
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
        )}
        {interactType === InteractType.Whitelist && whitelisting && (
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
        )}
        {/* Amount input (BOND/UNBOND/CUSTOM only) */}
        {!hasProviderAddress && (
          <>
            {(interactType === InteractType.Bond ||
              interactType === InteractType.Unbond ||
              interactType === InteractType.Custom ||
              interactType === InteractType.RunePool) && (
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
                        decimal={THORCHAIN_DECIMAL}
                        onChange={(value) => {
                          field.onChange(value)
                          onChangeInput(value)
                        }}
                      />
                    )}
                  />
                  {errors.amount && (
                    <div className="mt-1 text-sm text-error0 dark:text-error0d">{errors.amount.message}</div>
                  )}
                </div>
                {/* max. amount button (BOND/CUSTOM/UNBOND only) */}
                {(interactType === InteractType.Bond ||
                  interactType === InteractType.Custom ||
                  interactType === InteractType.Unbond ||
                  interactType === InteractType.RunePool) && (
                  <MaxBalanceButton
                    className="mb-10px"
                    color="neutral"
                    balance={{ amount: maxAmount, asset: asset }}
                    maxDollarValue={maxAmountPriceValue}
                    onClick={() => addMaxAmountHandler(maxAmount)}
                    disabled={isLoading}
                    onChange={() => getMemo()}
                  />
                )}
                {userNodeInfo && (interactType === InteractType.Bond || interactType === InteractType.Unbond) && (
                  <div className="p-4">
                    <div className="font-mainBold ml-[-2px] flex w-full justify-between text-[14px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'common.nodeAddress' })}
                      <div className="truncate pl-10px font-main text-[12px]">{userNodeInfo.nodeAddress}</div>
                    </div>
                    <div className="font-mainBold ml-[-2px] flex w-full justify-between text-[14px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'common.address.self' })}
                      <div className="truncate pl-10px font-main text-[12px]">{walletAddress}</div>
                    </div>
                    <div className="font-mainBold ml-[-2px] flex w-full justify-between py-10px text-[14px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'bonds.currentBond' })}
                      <div className="truncate pl-10px font-main text-[12px]">
                        {formatAssetAmountCurrency({
                          asset: AssetRuneNative,
                          amount: baseToAsset(bondBaseAmount),
                          trimZeros: true,
                          decimal: 0
                        })}
                      </div>
                    </div>
                  </div>
                )}
                <Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
                {isFeeError && renderFeeError}
              </div>
            )}
          </>
        )}

        {/* Fee input (BOND/UNBOND/CUSTOM only) */}
        {hasProviderAddress && (
          <>
            {interactType === InteractType.Bond && (
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
            )}
          </>
        )}
        {/* THORName — delegated to standalone component */}
        {interactType === InteractType.THORName && (
          <THORNameForm
            walletType={walletType}
            walletAccount={walletAccount}
            walletIndex={walletIndex}
            hdMode={hdMode}
            balance={balance}
            interact$={interact$}
            openExplorerTxUrl={openExplorerTxUrl}
            getExplorerTxUrl={getExplorerTxUrl}
            validatePassword$={validatePassword$}
            thorchainQuery={thorchainQuery}
            network={network}
            fee={feeRD}
            reloadFeesHandler={reloadFeesHandler}
            thorchainLastblock={thorchainLastblockRd}
          />
        )}
      </div>
      <div className="flex items-center justify-center">
        {interactType === InteractType.RunePool && (
          <FlatButton
            className="mt-20px min-w-[200px]"
            loading={isLoading}
            disabled={
              isLoading ||
              !runePoolAvailable ||
              (runePoolAction === Action.withdraw &&
                runePoolData &&
                RD.isSuccess(runePoolData) &&
                runePoolData.value.blocksLeft > 0) ||
              (runePoolAction === Action.add && !isValid)
            }
            type="submit"
            size="large">
            {submitLabel}
          </FlatButton>
        )}

        {interactType !== InteractType.RunePool && interactType !== InteractType.THORName && (
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
      {/* THORName has its own details section — skip parent's */}
      {interactType !== InteractType.THORName && (
        <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
          {/* memo */}
          <div className="my-20px w-full font-main text-[12px] uppercase dark:border-gray1d">
            <BaseButton
              className="group font-mainSemiBold flex w-full !justify-between !p-0 text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
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
                {interactType === InteractType.RunePool && (
                  <>
                    <div className="font-mainBold ml-[-2px] flex w-full justify-between pt-10px text-[14px]">
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
                                {intl.formatMessage(
                                  { id: 'common.time.days' },
                                  { days: `${data.daysLeft.toFixed(1)}` }
                                )}
                              </p>
                            </div>
                          )
                        )(runePoolData)}
                      </div>
                    </div>
                  </>
                )}

                <div className="font-mainBold ml-[-2px] flex w-full justify-between pt-10px text-[14px]">
                  {amountLabel}
                  <div className="truncate pl-10px font-main text-[12px]">
                    {formatAssetAmountCurrency({
                      amount:
                        interactType === InteractType.Unbond ? baseToAsset(_amountToSend) : baseToAsset(amountToSend),
                      asset: AssetRuneNative,
                      decimal: isUSDAsset(AssetRuneNative) ? 2 : 6,
                      trimZeros: !isUSDAsset(AssetRuneNative)
                    })}
                  </div>
                </div>

                <div className="font-mainBold ml-[-2px] flex w-full justify-between pt-10px text-[14px]">
                  {intl.formatMessage({ id: 'common.memo' })}
                  <div className="overflow pl-10px font-main text-[12px] break-normal">{memoLabel}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </form>
  )
}
