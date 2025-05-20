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
  baseToAsset,
  bn,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { Form, RadioChangeEvent, Tooltip } from 'antd'
import { FormInstance } from 'antd/es/form/Form'
import BigNumber from 'bignumber.js'
import { either as E } from 'fp-ts'
import { function as FP } from 'fp-ts'
import { option as O } from 'fp-ts'
import { debounce } from 'lodash'
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
  getWhitelistMemo
} from '../../../../helpers/memoHelper'
import { getUSDValue } from '../../../../helpers/poolHelperMaya'
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
  NodeInfosRD
} from '../../../../services/mayachain/types'
import { PoolShare, PoolSharesRD } from '../../../../services/midgard/midgardTypes'
import { ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { TxModal } from '../../../modal/tx'
import { SendAsset } from '../../../modal/tx/extra/SendAsset'
import * as StyledR from '../../../shared/form/Radio.styles'
import { AssetIcon } from '../../../uielements/assets/assetIcon'
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
  mayaAddress: string
  providerAddress: string
  operatorFee: number
  amount: BigNumber
  mayaname: string
  chainAddress: string
  chain: string
  preferredAsset: string
  expiry: number
  bondLpUnits: string
  assetPool: string
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
    poolShares
  } = props
  const intl = useIntl()

  const { asset } = balance
  const { walletAddress } = balance
  const pricePool = usePricePoolMaya()

  const [userNodeInfo, setUserNodeInfo] = useState<UserNodeInfo | undefined>(undefined)
  const [_amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)

  const nodes: NodeInfos = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.getOrElse(() => [] as NodeInfos)
      ),
    [nodesRD]
  )

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
    }
  }, [_amountToSend, interactType])

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const [form] = Form.useForm<FormValues>()
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
          (fee) => balance.amount.minus(fee)
        )
      ),
    [oFee, balance.amount]
  )

  const [maxAmmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(new CryptoAmount(maxAmount, asset)) // Initial state can be null or a suitable default

  useEffect(() => {
    const maxAmountPrice = getUSDValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool
    })

    if ((maxAmount && interactType === InteractType.Bond) || interactType === InteractType.Custom) {
      if (O.isSome(maxAmountPrice)) {
        const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
        setMaxAmountPriceValue(maxCryptoAmount)
      }
    }
  }, [asset, interactType, maxAmount, mayachainQuery, network, poolDetails, pricePool])

  const amountValidator = useCallback(
    async (_: unknown, value: BigNumber) => {
      switch (interactType) {
        case InteractType.Bond:
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
        case InteractType.Unbond:
          return H.validateUnboundAmountInput({
            input: value,
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' })
            }
          })
        case InteractType.Custom:
          return H.validateCustomAmountInput({
            input: value,
            errors: {
              msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
              msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterOrEqualThan' }, { amount: '0' })
            }
          })
        case InteractType.Leave:
          return Promise.resolve(true)
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
        console.log(error)
      }
    },
    500
  )

  const mayanameHandler = useCallback(() => {
    const mayaname = form.getFieldValue('mayaname')
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
  }, [debouncedFetch, form, mayachainQuery])

  const estimateMayanameHandler = useCallback(() => {
    const currentDate = new Date()

    form.validateFields()
    const mayaname = form.getFieldValue('mayaname')
    const chain = mayanameRegister ? form.getFieldValue('chain') : form.getFieldValue('aliasChain')
    const yearsToAdd = form.getFieldValue('expiry')
    const expirity =
      yearsToAdd === 1
        ? undefined
        : new Date(currentDate.getFullYear() + yearsToAdd, currentDate.getMonth(), currentDate.getDate())
    const chainAddress = mayanameRegister ? form.getFieldValue('chainAddress') : form.getFieldValue('aliasAddress')
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
  }, [balance.walletAddress, form, isOwner, mayachainQuery, mayanameRegister, mayanameUpdate])

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
    async (_: unknown, value: string) =>
      FP.pipe(
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
      ),
    [addressValidation, intl]
  )

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const getMemo = useCallback(() => {
    const mayaNodeAddress = form.getFieldValue('mayaAddress')
    const whitelistAdd = form.getFieldValue('providerAddress')
    const nodeOperatorFee = form.getFieldValue('operatorFee')
    const assetPool = form.getFieldValue('assetPool')
    const lpUnits = form.getFieldValue('bondLpUnits')
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
  }, [currentMemo, form, interactType, memo, whitelisting])

  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      // we have to validate input before storing into the state
      amountValidator(undefined, value)
        .then(() => {
          const newAmountToSend = assetToBase(assetAmount(value, CACAO_DECIMAL))
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

  const reset = useCallback(() => {
    resetInteractState()
    form.resetFields()
    setMemo('')
    setAmountToSend(ONE_CACAO_BASE_AMOUNT)
    setMayaname(O.none)
    setIsOwner(false)
    setMayanameQuoteValid(false)
    setMayanameUpdate(false)
    setMayanameAvailable(false)
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
        onClose={reset}
        onFinish={reset}
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
      <StyledR.Radio.Group onChange={() => estimateMayanameHandler()}>
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
    [estimateMayanameHandler]
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
      case InteractType.MAYAName:
        if (isOwner) {
          return intl.formatMessage({ id: 'common.isUpdateMayaname' })
        } else {
          return intl.formatMessage({ id: 'deposit.interact.actions.buyMayaname' })
        }
    }
  }, [interactType, intl, isOwner, whitelisting])

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
    form.setFieldValue('mayaAddress', nodeAddress)
    form.setFieldValue('bondLpUnits', unitsToUnbond)
    form.setFieldValue('assetPool', asset)
    getMemo()
  }

  const handleLearn = useCallback(() => {
    window.apiUrl.openExternal('https://docs.mayaprotocol.com/mayachain-dev-docs/concepts/transaction-memos')
  }, [])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    form.setFieldsValue({
      amount: baseToAsset(_amountToSend).amount()
    })
  }, [_amountToSend, form])

  const mayaNamefees: UIFeesRD = useMemo(() => {
    const fees: UIFees = [{ asset: AssetCacao, amount: _amountToSend }]
    return RD.success(fees)
  }, [_amountToSend])

  // Reset values whenever interactType has been changed (an user clicks on navigation tab)
  useEffect(() => {
    reset()
    setMemo('')
  }, [interactType, reset])

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
                  form={form}
                  getMemo={getMemo}
                />
              ))
            )}
          </div>
        )
      )
    )
  }, [poolShares, intl, isLoading, form, getMemo])

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

  return (
    <Styled.Form
      form={form}
      onFinish={() => setShowConfirmationModal(true)}
      initialValues={{
        mayaAddress: '',
        amount: bn(0),
        chain: MAYAChain,
        chainAddress: balance.walletAddress,
        expiry: 0
      }}>
      <>
        {/* Memo input (CUSTOM only) */}
        {interactType === InteractType.Custom && (
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
            {/* Display example memos */}
            <div className="mt-4">
              <Styled.InputLabel>{intl.formatMessage({ id: 'common.examples' }, { name: 'Memos' })}</Styled.InputLabel>
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
          </Styled.InputContainer>
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
          <Styled.InputContainer>
            <Styled.InputLabel>{intl.formatMessage({ id: 'common.nodeAddress' })}</Styled.InputLabel>
            <Form.Item
              name="mayaAddress"
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

        {/* Provider address input (whitelist only) */}
        {interactType === InteractType.Whitelist && (
          <>
            <Styled.InputContainer>
              {
                <>
                  <Styled.InputLabel>{intl.formatMessage({ id: 'common.providerAddress' })}</Styled.InputLabel>
                  <Form.Item
                    name="providerAddress"
                    rules={[
                      {
                        required: true,
                        validator: addressValidator
                      }
                    ]}>
                    <Styled.Input disabled={isLoading} onChange={() => getMemo()} size="large" />
                  </Form.Item>
                </>
              }
            </Styled.InputContainer>
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
          </>
        )}

        {/* Amount input (BOND/UNBOND/CUSTOM only) */}
        {interactType === InteractType.Custom && (
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
              <InputBigNumber disabled={isLoading} size="large" decimal={CACAO_DECIMAL} onChange={onChangeInput} />
            </Styled.FormItem>
            {/* max. amount button (BOND/CUSTOM only) */}
            {interactType === InteractType.Custom && (
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
          </Styled.InputContainer>
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
              <>
                {' '}
                <div className="ml-[-2px] mb-2 flex w-full justify-between font-mainBold text-[14px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage({ id: 'deposit.share.units' })}
                  <div className="truncate pl-10px font-main text-[12px]">
                    {intl.formatMessage({ id: 'common.noResult' })}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {interactType === InteractType.Bond && renderPoolShares}
        {interactType !== InteractType.MAYAName && (
          <Styled.Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} disabled={isLoading} />
        )}
        {isFeeError && renderFeeError}

        {/* Mayaname Button and Details*/}
        {interactType === InteractType.MAYAName && (
          <Styled.InputContainer>
            <div className="flex w-full items-center text-[12px]">
              <Styled.InputLabel>{intl.formatMessage({ id: 'common.mayaname' })}</Styled.InputLabel>
              <InfoIcon
                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                color="primary"
                tooltip={intl.formatMessage({ id: 'common.mayanameRegistrationSpecifics' })}
              />
            </div>

            <Styled.FormItem
              name="mayaname"
              rules={[
                {
                  required: true
                }
              ]}>
              <Styled.Input disabled={isLoading} size="large" onChange={() => mayanameHandler()} />
            </Styled.FormItem>
            {O.isSome(oMayaname) && !mayanameAvailable && !isOwner && renderMayanameError}
          </Styled.InputContainer>
        )}
        {/** Form item for unregistered mayaname */}
        {mayanameAvailable && (
          <Styled.InputContainer>
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
                    <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetAETH.chain}>
                      ARB
                    </StyledR.Radio>
                    <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetBTC.chain}>
                      BTC
                    </StyledR.Radio>
                    <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetETH.chain}>
                      ETH
                    </StyledR.Radio>
                    <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetRuneNative.chain}>
                      RUNE
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
                {/* Initial values needed for tns or mns register */}
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
                    <StyledR.Radio className="text-gray2 dark:text-gray2d" value={AssetCacao.chain}>
                      MAYA
                    </StyledR.Radio>
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
            <Styled.Fees className="mt-10px" fees={mayaNamefees} disabled={isLoading} />
          </Styled.InputContainer>
        )}
      </>
      <div className="flex items-center justify-center">
        {mayanameQuoteValid && (
          <FlatButton
            className="mt-10px min-w-[200px]"
            loading={isLoading}
            disabled={isLoading || !!form.getFieldsError().filter(({ errors }) => errors.length).length}
            type="submit"
            size="large">
            {submitLabel}
          </FlatButton>
        )}
        {interactType !== InteractType.MAYAName && (
          <FlatButton
            className="mt-10px min-w-[200px]"
            loading={isLoading}
            disabled={isLoading || !!form.getFieldsError().filter(({ errors }) => errors.length).length}
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
              <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125 " />
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
    </Styled.Form>
  )
}

const PoolShareItem = ({
  share,
  isLoading,
  form,
  getMemo
}: {
  share: PoolShare
  isLoading: boolean
  form: FormInstance
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
    form.setFieldValue('bondLpUnits', unitsToBond)
    form.setFieldValue('assetPool', asset)
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
        <Form.Item
          className="!m-0"
          name={`unitsToBond-${assetString}`}
          rules={[
            {
              required: true,
              message: 'Please enter a percentage'
            },
            {
              validator: (_, value) =>
                value && (parseFloat(value) <= 0 || parseFloat(value) > 100)
                  ? Promise.reject('Percentage must be between 0 and 100')
                  : Promise.resolve()
            }
          ]}>
          <Styled.Input
            className="mt-2 [&>input]:!bg-bg0 [&>input]:!p-1 [&>input]:!text-text2 dark:[&>input]:!bg-bg0d dark:[&>input]:!text-text2d"
            size="small"
            disabled={isLoading || bondableAssets.length === 0 || !isBondable}
            value={customPercentage}
            onChange={handleCustomPercentageChange}
            suffix="%"
            placeholder="Enter percentage (0-100)"
          />
        </Form.Item>
      )}
    </div>
  )
}
