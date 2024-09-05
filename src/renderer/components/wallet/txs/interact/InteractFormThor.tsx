import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { QuoteTHORNameParams, ThorchainQuery, ThornameDetails } from '@xchainjs/xchain-thorchain-query'
import {
  Asset,
  assetAmount,
  assetToBase,
  baseAmount,
  BaseAmount,
  baseToAsset,
  bn,
  CryptoAmount,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { Form, Tooltip } from 'antd'
import { RadioChangeEvent } from 'antd/lib/radio'
import BigNumber from 'bignumber.js'
import * as E from 'fp-ts/Either'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { debounce } from 'lodash'
import { useIntl } from 'react-intl'

import { ONE_RUNE_BASE_AMOUNT } from '../../../../../shared/mock/amount'
import { AssetAVAX, AssetBTC, AssetDOGE, AssetETH, AssetRuneNative } from '../../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../../../shared/wallet/types'
import { AssetUSDTDAC, ZERO_BASE_AMOUNT } from '../../../../const'
import { THORCHAIN_DECIMAL, isUSDAsset } from '../../../../helpers/assetHelper'
import { validateAddress } from '../../../../helpers/form/validation'
import { Action, getBondMemo, getLeaveMemo, getRunePoolMemo, getUnbondMemo } from '../../../../helpers/memoHelper'
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
import * as StyledR from '../../../shared/form/Radio.styles'
import { BaseButton, FlatButton, ViewTxButton } from '../../../uielements/button'
import { CheckButton } from '../../../uielements/button/CheckButton'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { SwitchButton } from '../../../uielements/button/SwitchButton'
import { UIFees, UIFeesRD } from '../../../uielements/fees'
import { InfoIcon } from '../../../uielements/info'
import { InputBigNumber } from '../../../uielements/input'
import { Label } from '../../../uielements/label'
import { validateTxAmountInput } from '../TxForm.util'
import * as H from './Interact.helpers'
import * as Styled from './Interact.styles'
import { InteractType } from './Interact.types'

type FormValues = {
  memo: string
  thorAddress: string
  providerAddress: string
  operatorFee: number
  amount: BigNumber
  thorname: string
  chainAddress: string
  chain: string
  preferredAsset: string
  expiry: number
}
type UserNodeInfo = {
  nodeAddress: string
  walletAddress: string
  bondAmount: BaseAmount
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
export const InteractFormThor: React.FC<Props> = (props) => {
  const {
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
  } = props
  const intl = useIntl()

  const { asset } = balance
  const { walletAddress } = balance
  const pricePool = usePricePool()
  const mimirKeys = useMimirConstants(['RUNEPOOLDEPOSITMATURITYBLOCKS', 'RUNEPOOLENABLED'])

  const [hasProviderAddress, setHasProviderAddress] = useState(false)

  const [userNodeInfo, setUserNodeInfo] = useState<UserNodeInfo | undefined>(undefined)
  const [_amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)
  const [runePoolAction, setRunePoolAction] = useState<Action>(Action.add)

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
  const runePoolAvialable = mimirKeys['RUNEPOOLENABLED'] === 1

  useEffect(() => {
    let foundNodeInfo: UserNodeInfo | undefined = undefined

    for (const node of nodes) {
      const matchingProvider = node.bondProviders.providers.find((provider) => walletAddress === provider.bondAddress)

      if (matchingProvider) {
        // If a matching provider is found, set the UserNodeInfo state
        foundNodeInfo = {
          nodeAddress: node.address,
          walletAddress: matchingProvider.bondAddress,
          bondAmount: matchingProvider.bond
        }
        break // Exit the loop after finding the first match
      }
    }

    if (foundNodeInfo) {
      setUserNodeInfo(foundNodeInfo)
    } else {
      setUserNodeInfo(undefined) // Reset the state if no match is found
    }
  }, [nodes, walletAddress]) // Re-run the effect if nodes or walletAddress changes

  const [memo, setMemo] = useState<string>('')
  const amountToSend = useMemo(() => {
    switch (interactType) {
      case 'bond':
      case 'custom':
      case 'thorname':
      case 'mayaname':
        return _amountToSend
      case 'leave':
      case 'unbond':
        return ZERO_BASE_AMOUNT
      case 'runePool': {
        const amnt = runePoolAction === Action.add ? _amountToSend : ZERO_BASE_AMOUNT
        return amnt
      }
    }
  }, [_amountToSend, interactType, runePoolAction])

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const [form] = Form.useForm<FormValues>()

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  // state variable for thornames
  const [oThorname, setThorname] = useState<O.Option<ThornameDetails>>(O.none)
  const [thornameAvailable, setThornameAvailable] = useState<boolean>(false) // if thorname is available
  const [thornameUpdate, setThornameUpdate] = useState<boolean>(false) // allow to update
  const [thornameRegister, setThornameRegister] = useState<boolean>(false) // allow to update
  const [thornameQuoteValid, setThornameQuoteValid] = useState<boolean>(false) // if the quote is valid then allow to buy
  const [isOwner, setIsOwner] = useState<boolean>(false) // if the thorname.owner is the wallet address then allow to update
  const [preferredAsset, setPreferredAsset] = useState<Asset>()
  const [aliasChain, setAliasChain] = useState<string>('')

  const [currentMemo, setCurrentMemo] = useState('')

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

  const handleMemo = useCallback(() => {
    const memoValue = form.getFieldValue('memo') as string
    // Update the state with the adjusted memo value
    setCurrentMemo(memoValue)
  }, [form])

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

  const renderThornameError = useMemo(
    () => (
      <Label size="big" color="error">
        {intl.formatMessage({ id: 'common.thornameError' })}
      </Label>
    ),
    [intl]
  )
  const renderRunePoolWarning = useMemo(
    () => (
      <Label size="big" color="warning">
        {intl.formatMessage({ id: 'runePool.detail.warning' })}
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
            if (interactType === 'unbond') {
              let maxAmountBalOrBond: BaseAmount = ZERO_BASE_AMOUNT
              maxAmountBalOrBond = userNodeInfo ? userNodeInfo.bondAmount : ZERO_BASE_AMOUNT
              return maxAmountBalOrBond
            } else if (interactType === 'runePool' && runePoolAction === Action.withdraw) {
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

  const [maxAmmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(maxAmount, asset)) // Initial state can be null or a suitable default

  useEffect(() => {
    const maxAmountPrice = getPoolPriceValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool
    })

    if ((maxAmount && interactType === 'bond') || interactType === 'custom' || interactType === 'runePool') {
      if (O.isSome(maxAmountPrice)) {
        const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
        setMaxAmountPriceValue(maxCryptoAmount)
      }
    }
  }, [asset, interactType, maxAmount, network, poolDetails, pricePool])

  const amountValidator = useCallback(
    async (_: unknown, value: BigNumber) => {
      switch (interactType) {
        case 'bond':
          // similar to any other form for sending any amount
          return validateTxAmountInput({
            input: value,
            maxAmount: baseToAsset(maxAmount),
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
              msg3: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalance' })
            }
          })
        case 'unbond':
          return H.validateUnboundAmountInput({
            input: value,
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' })
            }
          })
        case 'custom':
          return H.validateCustomAmountInput({
            input: value,
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterOrEqualThan' }, { amount: '0' })
            }
          })
        case 'runePool':
          return H.validateCustomAmountInput({
            input: value,
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterOrEqualThan' }, { amount: '0' })
            }
          })
        case 'leave':
          return Promise.resolve(true)
      }
    },
    [interactType, intl, maxAmount]
  )

  // const expireDate = (value: number) => {
  //   const yearsToAdd = value

  //   return newDate
  // }

  const debouncedFetch = debounce(
    async (thorname, setThorname, setThornameAvailable, setThornameUpdate, setIsOwner, thorchainQuery, balance) => {
      try {
        const thornameDetails = await thorchainQuery.getThornameDetails(thorname)
        if (thornameDetails) {
          setThorname(O.some(thornameDetails))

          setThornameAvailable(thornameDetails.owner === '' || balance.walletAddress === thornameDetails.owner)
          setThornameUpdate(thorname === thornameDetails.name && thornameDetails.owner === '')
          setThornameRegister(thornameDetails.name === '')
          setIsOwner(balance.walletAddress === thornameDetails.owner)
        }
      } catch (error) {
        setThornameAvailable(true)
      }
      // setThorname(O.none)
    },
    500
  )

  const thornameHandler = useCallback(() => {
    const thorname = form.getFieldValue('thorname')
    setThornameQuoteValid(false)
    setMemo('')
    if (thorname !== '') {
      debouncedFetch(
        thorname,
        setThorname,
        setThornameAvailable,
        setThornameUpdate,
        setIsOwner,
        thorchainQuery,
        balance
      )
    }
  }, [balance, debouncedFetch, form, thorchainQuery])

  const estimateThornameHandler = useCallback(() => {
    const currentDate = new Date()

    form.validateFields()
    const name = form.getFieldValue('thorname')
    const chain = thornameRegister ? form.getFieldValue('chain') : form.getFieldValue('aliasChain')
    const yearsToAdd = form.getFieldValue('expiry')
    const expiry =
      yearsToAdd === 1
        ? undefined
        : new Date(currentDate.getFullYear() + yearsToAdd, currentDate.getMonth(), currentDate.getDate())
    const chainAddress = thornameRegister ? form.getFieldValue('chainAddress') : form.getFieldValue('aliasAddress')
    const owner = balance.walletAddress
    if (name !== undefined && chain !== undefined && chainAddress !== undefined) {
      const fetchThornameQuote = async () => {
        try {
          const params: QuoteTHORNameParams = {
            name,
            chain,
            chainAddress,
            owner,
            preferredAsset,
            expiry,
            isUpdate: thornameUpdate || isOwner
          }

          const thornameQuote = await thorchainQuery.estimateThorname(params)

          if (thornameQuote) {
            setMemo(thornameQuote.memo)
            setAmountToSend(thornameQuote.value.baseAmount)
            setThornameQuoteValid(true)
          }
        } catch (error) {
          console.error('Error fetching fetchThornameQuote:', error)
        }
      }
      fetchThornameQuote()
    }
  }, [balance.walletAddress, form, isOwner, preferredAsset, thorchainQuery, thornameRegister, thornameUpdate])

  const handleRadioAssetChange = useCallback((e: RadioChangeEvent) => {
    const asset = e.target.value
    setPreferredAsset(asset)
  }, [])

  const handleRadioChainChange = useCallback((e: RadioChangeEvent) => {
    const chain = e.target.value
    setAliasChain(chain)
  }, [])

  const addMaxAmountHandler = useCallback(
    (maxAmount: BaseAmount) => {
      setAmountToSend(maxAmount)
    },
    [setAmountToSend]
  )

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      const inputAddres = value.toLowerCase()
      const nodeIndex = H.findNodeIndex(nodes, inputAddres)
      if (interactType === 'unbond' && nodeIndex > -1) {
        return Promise.reject(intl.formatMessage({ id: 'bonds.validations.bondStatusActive' }))
      }
      return FP.pipe(
        value,
        validateAddress(
          addressValidation,
          intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' }),
          intl.formatMessage({ id: 'wallet.errors.address.invalid' })
        ),
        E.fold(
          (e) => Promise.reject(e),
          () => Promise.resolve()
        )
      )
    },
    [addressValidation, interactType, intl, nodes]
  )
  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const getMemo = useCallback(() => {
    const thorAddress = form.getFieldValue('thorAddress')
    const providerAddress =
      form.getFieldValue('providerAddress') === undefined ? undefined : form.getFieldValue('providerAddress')
    const nodeOperatorFee = form.getFieldValue('operatorFee')
    const feeInBasisPoints = nodeOperatorFee ? nodeOperatorFee * 100 : undefined

    let createMemo = ''

    switch (interactType) {
      case 'bond': {
        createMemo = getBondMemo(thorAddress, providerAddress, feeInBasisPoints)
        break
      }
      case 'unbond': {
        createMemo = getUnbondMemo(thorAddress, _amountToSend, providerAddress)
        break
      }
      case 'leave': {
        createMemo = getLeaveMemo(thorAddress)
        break
      }
      case 'runePool': {
        createMemo = getRunePoolMemo({
          action: runePoolAction,
          bps: H.getRunePoolWithdrawBps(runePoolProvider.value, _amountToSend)
        })
        break
      }
      case 'custom': {
        createMemo = currentMemo
        break
      }
      case 'thorname': {
        createMemo = memo
        break
      }
    }
    setMemo(createMemo)
    return createMemo
  }, [_amountToSend, currentMemo, form, interactType, memo, runePoolAction, runePoolProvider.value])

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          const newAmountToSend = assetToBase(assetAmount(value, THORCHAIN_DECIMAL))
          setAmountToSend(newAmountToSend)
        })
        .catch(() => {})
      // do nothing, Ant' form does the job for us to show an error message
    },
    [amountValidator]
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
        memo: getMemo()
      })
    )
  }, [subscribeInteractState, interact$, walletType, walletAccount, walletIndex, hdMode, amountToSend, getMemo])

  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const reset = useCallback(() => {
    resetInteractState()
    const allFields = form.getFieldsValue()
    const fieldsToReset = Object.keys(allFields).filter((field) => field !== 'thorAddress')
    form.resetFields(fieldsToReset)
    setHasProviderAddress(false)
    setMemo('')
    setAmountToSend(ZERO_BASE_AMOUNT)
    setThorname(O.none)
    setIsOwner(false)
    setThornameQuoteValid(false)
    setThornameUpdate(false)
    setThornameAvailable(false)
  }, [form, resetInteractState])

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
        onClose={reset}
        onFinish={reset}
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
  }, [interactState, intl, reset, sendTxStartTime, openExplorerTxUrl, getExplorerTxUrl, asset, amountToSend, network])

  const memoLabel = useMemo(
    () => (
      <Tooltip title={memo} key="tooltip-memo">
        {memo}
      </Tooltip>
    ),
    [memo]
  )

  const renderRadioGroup = useMemo(
    () => (
      <StyledR.Radio.Group onChange={() => estimateThornameHandler()}>
        <StyledR.Radio className="text-gray2 dark:text-gray2d" value={1}>
          1 year
        </StyledR.Radio>
        <StyledR.Radio className="text-gray2 dark:text-gray2d" value={2}>
          2 years
        </StyledR.Radio>
        <StyledR.Radio className="text-gray2 dark:text-gray2d" value={3}>
          3 years
        </StyledR.Radio>
        <StyledR.Radio className="text-gray2 dark:text-gray2d" value={5}>
          5 years
        </StyledR.Radio>
      </StyledR.Radio.Group>
    ),
    [estimateThornameHandler]
  )

  const submitLabel = useMemo(() => {
    switch (interactType) {
      case 'bond':
        if (hasProviderAddress) {
          return intl.formatMessage({ id: 'deposit.interact.actions.addBondProvider' })
        } else {
          return intl.formatMessage({ id: 'deposit.interact.actions.bond' })
        }
      case 'unbond':
        return intl.formatMessage({ id: 'deposit.interact.actions.unbond' })
      case 'leave':
        return intl.formatMessage({ id: 'deposit.interact.actions.leave' })
      case 'runePool': {
        const label =
          runePoolAction === Action.add
            ? intl.formatMessage({ id: 'wallet.action.deposit' })
            : intl.formatMessage({ id: 'deposit.withdraw.sym' })
        return label
      }
      case 'custom':
        return intl.formatMessage({ id: 'wallet.action.send' })
      case 'thorname':
        if (isOwner) {
          return intl.formatMessage({ id: 'common.isUpdate' })
        } else {
          return intl.formatMessage({ id: 'deposit.interact.actions.buyThorname' })
        }
    }
  }, [interactType, hasProviderAddress, intl, runePoolAction, isOwner])

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        feeRD,
        RD.map((fee) => [
          {
            asset: AssetRuneNative,
            amount: interactType === 'bond' ? fee.plus(ONE_RUNE_BASE_AMOUNT) : fee
          }
        ])
      ),
    [feeRD, interactType]
  )

  const onClickHasProviderAddress = useCallback(() => {
    // clean address
    form.setFieldsValue({ providerAddress: undefined })
    form.setFieldsValue({ operatorFee: undefined })
    FP.pipe(
      feeRD,
      RD.fold(
        () => {}, // Handle the initial or loading state
        () => {}, // Handle the pending state
        (error) => {
          console.error('Error calculating fee:', error)
        },
        (fee) => {
          // Calculate the amountToSend
          const amountToSend = fee.plus(ONE_RUNE_BASE_AMOUNT)
          setAmountToSend(amountToSend)
        }
      )
    )
    // toggle
    setHasProviderAddress((v) => !v)
    getMemo()
  }, [form, getMemo, feeRD])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    form.setFieldsValue({
      amount: baseToAsset(_amountToSend).amount()
    })
  }, [_amountToSend, form])

  const thorNamefees: UIFeesRD = useMemo(() => {
    const fees: UIFees = [{ asset: AssetRuneNative, amount: _amountToSend }]
    return RD.success(fees)
  }, [_amountToSend])

  // Reset values whenever interactType has been changed (an user clicks on navigation tab)
  useEffect(() => {
    reset()
    setMemo('')
  }, [interactType, reset])

  const [showDetails, setShowDetails] = useState<boolean>(true)
  const address = ''
  const amount = bn(0)
  const bondBaseAmount = userNodeInfo ? userNodeInfo.bondAmount : baseAmount(0)

  return (
    <Styled.Form
      form={form}
      onFinish={() => setShowConfirmationModal(true)}
      initialValues={{
        thorAddress: address,
        amount: amount,
        chain: THORChain,
        chainAddress: balance.walletAddress,
        expiry: 0
      }}>
      <>
        {/* Memo input (CUSTOM only) */}
        {interactType === 'custom' && (
          <Styled.InputContainer>
            <Styled.InputLabel>{intl.formatMessage({ id: 'common.memo' })}</Styled.InputLabel>
            <Form.Item
              name="memo"
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
                }
              ]}>
              <Styled.Input disabled={isLoading} onChange={handleMemo} size="large" />
            </Form.Item>
          </Styled.InputContainer>
        )}
        {/** Rune Pool Only */}
        {interactType === 'runePool' && (
          <div>
            <span style={{ display: 'inline-block' }}>
              <SwitchButton
                active={runePoolAction === Action.add}
                onChange={(active) => setRunePoolAction(active ? Action.add : Action.withdraw)}
              />
            </span>
            <span style={{ marginLeft: '10px', display: 'inline-block' }}>
              <Styled.InputLabel>
                {runePoolAction === Action.add
                  ? intl.formatMessage({ id: 'runePool.detail.titleDeposit' })
                  : intl.formatMessage({ id: 'runePool.detail.titleWithdraw' })}
              </Styled.InputLabel>
              {!runePoolAvialable && intl.formatMessage({ id: 'runePool.detail.availability' })}
            </span>
            {runePoolProvider.value.gt(0) && runePoolAction === Action.add && renderRunePoolWarning}
          </div>
        )}

        {/* Node address input (BOND/UNBOND/LEAVE only) */}
        {(interactType === 'bond' || interactType === 'unbond' || interactType === 'leave') && (
          <Styled.InputContainer>
            <Styled.InputLabel>{intl.formatMessage({ id: 'common.nodeAddress' })}</Styled.InputLabel>
            <Form.Item
              name="thorAddress"
              rules={[
                {
                  required: true,
                  validator: addressValidator
                }
              ]}>
              <Styled.Input disabled={isLoading} onChange={() => getMemo()} size="large" />
            </Form.Item>
          </Styled.InputContainer>
        )}

        {/* Provider address input (BOND/UNBOND/ only) */}
        {(interactType === 'bond' || interactType === 'unbond') && (
          <Styled.InputContainer style={{ paddingBottom: '20px' }}>
            <CheckButton checked={hasProviderAddress} clickHandler={onClickHasProviderAddress} disabled={isLoading}>
              {intl.formatMessage({ id: 'deposit.interact.label.bondprovider' })}
            </CheckButton>
            {hasProviderAddress && (
              <>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.providerAddress' })}</Styled.InputLabel>
                <Form.Item
                  name="providerAddress"
                  rules={[
                    {
                      required: hasProviderAddress,
                      validator: addressValidator
                    }
                  ]}>
                  <Styled.Input disabled={isLoading} onChange={() => getMemo()} size="large" />
                </Form.Item>
              </>
            )}
          </Styled.InputContainer>
        )}

        {/* Amount input (BOND/UNBOND/CUSTOM only) */}
        {!hasProviderAddress && (
          <>
            {(interactType === 'bond' ||
              interactType === 'unbond' ||
              interactType === 'custom' ||
              interactType === 'runePool') && (
              <Styled.InputContainer>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.amount' })}</Styled.InputLabel>
                <Styled.FormItem
                  name="amount"
                  rules={[
                    {
                      required: true,
                      validator: amountValidator
                    }
                  ]}>
                  <InputBigNumber
                    disabled={isLoading}
                    size="large"
                    decimal={THORCHAIN_DECIMAL}
                    onChange={onChangeInput}
                  />
                </Styled.FormItem>
                {/* max. amount button (BOND/CUSTOM/UNBOND only) */}
                {(interactType === 'bond' ||
                  interactType === 'custom' ||
                  interactType === 'unbond' ||
                  interactType === 'runePool') && (
                  <MaxBalanceButton
                    className="mb-10px"
                    color="neutral"
                    balance={{ amount: maxAmount, asset: asset }}
                    maxDollarValue={maxAmmountPriceValue}
                    onClick={() => addMaxAmountHandler(maxAmount)}
                    disabled={isLoading}
                    onChange={() => getMemo()}
                  />
                )}
                {userNodeInfo && (interactType === 'bond' || interactType === 'unbond') && (
                  <div className="p-4">
                    <div className="ml-[-2px] flex w-full justify-between font-mainBold text-[14px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'common.nodeAddress' })}
                      <div className="truncate pl-10px font-main text-[12px]">{userNodeInfo.nodeAddress}</div>
                    </div>
                    <div className="ml-[-2px] flex w-full justify-between font-mainBold text-[14px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'common.address.self' })}
                      <div className="truncate pl-10px font-main text-[12px]">{walletAddress}</div>
                    </div>
                    <div className="ml-[-2px] flex w-full justify-between  py-10px font-mainBold text-[14px] text-gray2 dark:text-gray2d">
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
                <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
                {isFeeError && renderFeeError}
              </Styled.InputContainer>
            )}
          </>
        )}

        {hasProviderAddress && (
          <>
            {interactType === 'unbond' && (
              <Styled.InputContainer>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.amount' })}</Styled.InputLabel>
                <Styled.FormItem
                  name="amount"
                  rules={[
                    {
                      required: true,
                      validator: amountValidator
                    }
                  ]}>
                  <InputBigNumber
                    disabled={isLoading}
                    size="large"
                    decimal={THORCHAIN_DECIMAL}
                    onChange={onChangeInput}
                  />
                </Styled.FormItem>
                <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
                {isFeeError && renderFeeError}
              </Styled.InputContainer>
            )}
          </>
        )}

        {/* Fee input (BOND/UNBOND/CUSTOM only) */}
        {hasProviderAddress && (
          <>
            {interactType === 'bond' && (
              <Styled.InputContainer>
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.fee.nodeOperator' })}</Styled.InputLabel>
                <Styled.FormItem
                  name="operatorFee"
                  rules={[
                    {
                      required: false
                    }
                  ]}>
                  <Styled.Input
                    placeholder="Enter a % value, memo will populate with Basis Points automatically"
                    disabled={isLoading}
                    size="large"
                    onChange={() => getMemo()}
                  />
                </Styled.FormItem>
              </Styled.InputContainer>
            )}
          </>
        )}
        {/* Thorname Button and Details*/}
        <>
          {interactType === 'thorname' && (
            <Styled.InputContainer>
              <div className="flex w-full items-center text-[12px]">
                <Styled.InputLabel>{intl.formatMessage({ id: 'common.thorname' })}</Styled.InputLabel>
                <InfoIcon
                  className="ml-[3px] h-[15px] w-[15px] text-inherit"
                  tooltip={intl.formatMessage({ id: 'common.thornameRegistrationSpecifics' })}
                  color="primary"
                />
              </div>

              <Styled.FormItem
                name="thorname"
                rules={[
                  {
                    required: true
                  }
                ]}>
                <Styled.Input disabled={isLoading} size="large" onChange={() => thornameHandler()} />
              </Styled.FormItem>
              {O.isSome(oThorname) && !thornameAvailable && !isOwner && renderThornameError}
            </Styled.InputContainer>
          )}
          {/** Form item for unregistered thorname */}
          {thornameAvailable && (
            <Styled.InputContainer>
              {isOwner ? (
                <CheckButton
                  checked={thornameUpdate || isOwner}
                  clickHandler={() => setThornameUpdate(true)}
                  disabled={isLoading}>
                  {intl.formatMessage({ id: 'common.isUpdate' })}
                </CheckButton>
              ) : (
                <></>
              )}
              {!thornameRegister ? (
                <>
                  <div className="flex w-full items-center text-[12px]">
                    <Styled.InputLabel>{intl.formatMessage({ id: 'common.preferredAsset' })}</Styled.InputLabel>
                  </div>
                  <Styled.FormItem
                    name="preferredAsset"
                    rules={[
                      {
                        required: false
                      }
                    ]}>
                    <StyledR.Radio.Group onChange={handleRadioAssetChange} value={preferredAsset}>
                      <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetBTC}>
                        BTC
                      </StyledR.Radio>
                      <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetETH}>
                        ETH
                      </StyledR.Radio>
                      <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetUSDTDAC}>
                        USDT
                      </StyledR.Radio>
                    </StyledR.Radio.Group>
                  </Styled.FormItem>
                  {/* Add input fields for aliasChain, aliasAddress, and expiry */}
                  <Styled.InputLabel>{intl.formatMessage({ id: 'common.aliasChain' })}</Styled.InputLabel>
                  <Styled.FormItem
                    name="aliasChain"
                    rules={[
                      {
                        required: true,
                        message: 'Please provide an alias chain.'
                      }
                    ]}>
                    <StyledR.Radio.Group onChange={handleRadioChainChange} value={aliasChain}>
                      <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetAVAX.chain}>
                        AVAX
                      </StyledR.Radio>
                      <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetBTC.chain}>
                        BTC
                      </StyledR.Radio>
                      <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetETH.chain}>
                        ETH
                      </StyledR.Radio>
                      <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetDOGE}>
                        DOGE
                      </StyledR.Radio>
                    </StyledR.Radio.Group>
                  </Styled.FormItem>
                  <Styled.InputLabel>{intl.formatMessage({ id: 'common.aliasAddress' })}</Styled.InputLabel>
                  <Styled.FormItem
                    name="aliasAddress"
                    rules={[
                      {
                        required: true,
                        message: 'Please provide an alias address.'
                      }
                    ]}>
                    <Styled.Input disabled={isLoading} size="middle" />
                  </Styled.FormItem>
                  <Styled.InputLabel>{intl.formatMessage({ id: 'common.expiry' })}</Styled.InputLabel>
                  <Styled.FormItem
                    name="expiry"
                    rules={[
                      {
                        required: false
                      }
                    ]}>
                    {renderRadioGroup}
                  </Styled.FormItem>
                </>
              ) : (
                <>
                  {/* Initial values needed for tns register */}
                  <Styled.InputLabel>{intl.formatMessage({ id: 'common.aliasChain' })}</Styled.InputLabel>
                  <Styled.FormItem
                    name="chain"
                    rules={[
                      {
                        required: true,
                        message: 'Please provide an alias chain.'
                      }
                    ]}>
                    <StyledR.Radio.Group>
                      <StyledR.Radio value={AssetRuneNative.chain}>THOR</StyledR.Radio>
                    </StyledR.Radio.Group>
                  </Styled.FormItem>
                  <Styled.InputLabel>{intl.formatMessage({ id: 'common.aliasAddress' })}</Styled.InputLabel>
                  <Styled.FormItem
                    name="chainAddress"
                    rules={[
                      {
                        required: true,
                        message: 'Please provide an alias address.'
                      }
                    ]}>
                    <Styled.Input disabled={isLoading} size="middle" />
                  </Styled.FormItem>
                  <Styled.InputLabel>{intl.formatMessage({ id: 'common.expiry' })}</Styled.InputLabel>
                  <Styled.FormItem
                    name="expiry"
                    rules={[
                      {
                        required: true
                      }
                    ]}>
                    {renderRadioGroup}
                  </Styled.FormItem>
                </>
              )}
              <Styled.Fees className="mt-10px" fees={thorNamefees} disabled={isLoading} />
            </Styled.InputContainer>
          )}
        </>
      </>
      {thornameQuoteValid && (
        <>
          <div>
            <FlatButton
              className="mt-10px min-w-[200px]"
              loading={isLoading}
              disabled={isLoading || !!form.getFieldsError().filter(({ errors }) => errors.length).length}
              type="submit"
              size="large">
              {submitLabel}
            </FlatButton>
          </div>
        </>
      )}

      <div>
        {interactType !== 'thorname' && (
          <FlatButton
            className="mt-10px min-w-[200px]"
            loading={isLoading}
            disabled={
              isLoading ||
              !runePoolAvialable ||
              (runePoolAction === Action.withdraw &&
                runePoolData &&
                RD.isSuccess(runePoolData) &&
                runePoolData.value.blocksLeft > 0) ||
              !!form.getFieldsError().filter(({ errors }) => errors.length).length
            }
            type="submit"
            size="large">
            {submitLabel}
          </FlatButton>
        )}
      </div>
      <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
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
              {FP.pipe(
                oThorname,
                O.map(({ owner, name, aliases, preferredAsset, expireBlockHeight }) => {
                  if (owner || name || aliases || preferredAsset || expireBlockHeight) {
                    return (
                      <>
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div>{intl.formatMessage({ id: 'common.thorname' })}</div>
                          <div>{name}</div>
                        </div>
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
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          {intl.formatMessage({ id: 'common.preferredAsset' })}
                          <div>{preferredAsset}</div>
                        </div>
                      </>
                    )
                  }
                  return null
                }),
                O.toNullable
              )}
              {interactType === 'runePool' && (
                <>
                  <div className="ml-[-2px] flex w-full justify-between pt-10px font-mainBold text-[14px]">
                    {intl.formatMessage({ id: 'runePool.detail.daysLeft' })}
                    <div className="truncate pl-10px font-main text-[12px]">
                      {RD.fold(
                        () => <p>{emptyString}</p>,
                        () => <p>{emptyString}</p>,
                        (error: Error) => <p>Error: {error.message}</p>,
                        (data: { daysLeft: number; blocksLeft: number }) => (
                          <div>
                            <p>
                              {intl.formatMessage({ id: 'common.time.days' }, { days: `${data.daysLeft.toFixed(1)}` })}
                            </p>
                          </div>
                        )
                      )(runePoolData)}
                    </div>
                  </div>
                </>
              )}

              <div className="ml-[-2px] flex w-full justify-between pt-10px font-mainBold text-[14px]">
                {intl.formatMessage({ id: 'common.amount' })}
                <div className="truncate pl-10px font-main text-[12px]">
                  {formatAssetAmountCurrency({
                    amount: baseToAsset(amountToSend),
                    asset: AssetRuneNative,
                    decimal: isUSDAsset(AssetRuneNative) ? 2 : 6,
                    trimZeros: !isUSDAsset(AssetRuneNative)
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
    </Styled.Form>
  )
}
