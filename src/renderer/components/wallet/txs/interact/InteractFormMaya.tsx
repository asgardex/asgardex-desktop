import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, CACAO_DECIMAL, MAYAChain } from '@xchainjs/xchain-mayachain'
import { MayachainQuery } from '@xchainjs/xchain-mayachain-query'
import { PoolDetails } from '@xchainjs/xchain-mayamidgard'
import { MAYANameDetails } from '@xchainjs/xchain-mayamidgard-query'
import {
  BaseAmount,
  CryptoAmount,
  assetAmount,
  assetToBase,
  baseAmount,
  baseToAsset,
  bn,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { Form, Tooltip } from 'antd'
import BigNumber from 'bignumber.js'
import * as E from 'fp-ts/Either'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { debounce } from 'lodash'
import { useIntl } from 'react-intl'

import { isKeystoreWallet, isLedgerWallet } from '../../../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../../const'
import { isUSDAsset } from '../../../../helpers/assetHelper'
import { validateAddress } from '../../../../helpers/form/validation'
import { getBondMemo, getLeaveMemo, getUnbondMemo } from '../../../../helpers/memoHelper'
import { getPoolPriceValue } from '../../../../helpers/poolHelperMaya'
import { usePricePoolMaya } from '../../../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../../services/chain/types'
import { AddressValidation, GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../services/clients'
import { INITIAL_INTERACT_STATE } from '../../../../services/mayachain/const'
import { InteractState, InteractStateHandler, NodeInfos, NodeInfosRD } from '../../../../services/mayachain/types'
import { ValidatePasswordHandler, WalletBalance } from '../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../modal/confirmation'
import { TxModal } from '../../../modal/tx'
import { SendAsset } from '../../../modal/tx/extra/SendAsset'
import { BaseButton, FlatButton, ViewTxButton } from '../../../uielements/button'
import { CheckButton } from '../../../uielements/button/CheckButton'
import { MaxBalanceButton } from '../../../uielements/button/MaxBalanceButton'
import { UIFeesRD } from '../../../uielements/fees'
import { InfoIcon } from '../../../uielements/info'
import { InputBigNumber } from '../../../uielements/input'
import { Label } from '../../../uielements/label'
import { checkMemo } from '../TxForm.helpers'
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
}
export const InteractFormMaya: React.FC<Props> = (props) => {
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
    nodes: nodesRD
  } = props
  const intl = useIntl()

  const { asset } = balance
  const { walletAddress } = balance
  const pricePool = usePricePoolMaya()

  const [hasProviderAddress, setHasProviderAddress] = useState(false)

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
      case 'mayaname':
      case 'thorname':
      case 'runePool':
        return _amountToSend
      case 'unbond':
      case 'leave':
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
  const [swapMemoDetected, setSwapMemoDetected] = useState<boolean>(false)
  const [affiliateTracking, setAffiliateTracking] = useState<string>('')

  const oFee: O.Option<BaseAmount> = useMemo(() => FP.pipe(feeRD, RD.toOption), [feeRD])

  // state variable for mayanames
  const [oMayaname, setMayaname] = useState<O.Option<MAYANameDetails>>(O.none)
  //const [mayanameAvailable, setMayanameAvailable] = useState<boolean>(false) // if Mayaname is available
  //const [mayanameUpdate, setMayanameUpdate] = useState<boolean>(false) // allow to update
  //const [mayanameRegister, setMayanameRegister] = useState<boolean>(false) // allow to update
  //const [mayanameQuoteValid, setMayanameQuoteValid] = useState<boolean>(false) // if the quote is valid then allow to buy
  // const [isOwner, setIsOwner] = useState<boolean>(false) // if the mayaname.owner is the wallet address then allow to update
  // const [preferredAsset, setPreferredAsset] = useState<Asset>()
  // const [aliasChain, setAliasChain] = useState<string>('')
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
    let memoValue = form.getFieldValue('memo') as string

    // Check if a swap memo is detected
    if (checkMemo(memoValue)) {
      const suffixPattern = /:dx:\d+$/ // Regex to match ':dx:' followed by any number

      // Check if memo ends with the suffix pattern
      if (!suffixPattern.test(memoValue)) {
        // Remove any partial ':dx:' pattern before appending
        memoValue = memoValue.replace(/:dx:\d*$/, '')

        // Append ':dx:5'
        memoValue += ':dx:5'
      }

      setSwapMemoDetected(true)
      setAffiliateTracking(
        memoValue.endsWith(':dx:10') ? `Swap memo detected` : `Swap memo detected 5bps affiliate fee applied`
      )
    } else {
      setSwapMemoDetected(false)
    }
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
    const maxAmountPrice = getPoolPriceValue({
      balance: { asset, amount: maxAmount },
      poolDetails,
      pricePool
    })

    if ((maxAmount && interactType === 'bond') || interactType === 'custom') {
      if (O.isSome(maxAmountPrice)) {
        const maxCryptoAmount = new CryptoAmount(maxAmountPrice.value, pricePool.asset)
        setMaxAmountPriceValue(maxCryptoAmount)
      }
    }
  }, [asset, interactType, maxAmount, mayachainQuery, network, poolDetails, pricePool])

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

  const debouncedFetch = debounce(async (mayaname, setMayaname, setShowDetails, mayachainQuery) => {
    try {
      const mayanameDetails = await mayachainQuery.getMAYANameDetails(mayaname)
      if (mayanameDetails) {
        setMayaname(O.some(mayanameDetails))
        setShowDetails(true)
        //setMayanameAvailable(mayanameDetails.owner === '' || balance.walletAddress === mayanameDetails.owner)
        //setMayanameUpdate(mayaname === mayanameDetails.name && mayanameDetails.owner === '')
        //setMayanameRegister(mayanameDetails.name === '')
        //setIsOwner(balance.walletAddress === mayanameDetails.owner)
      }
    } catch (error) {
      console.log(error)
    }
  }, 500)

  const mayanameHandler = useCallback(() => {
    const mayaname = form.getFieldValue('mayaname')
    setMemo('')
    if (mayaname !== '') {
      debouncedFetch(mayaname, setMayaname, setShowDetails, mayachainQuery)
    }
  }, [debouncedFetch, form, mayachainQuery])

  // const estimateThornameHandler = useCallback(() => {
  //   const currentDate = new Date()

  //   form.validateFields()
  //   const thorname = form.getFieldValue('thorname')
  //   const chain = thornameRegister ? form.getFieldValue('chain') : form.getFieldValue('aliasChain')
  //   const yearsToAdd = form.getFieldValue('expiry')
  //   const expirity =
  //     yearsToAdd === 1
  //       ? undefined
  //       : new Date(currentDate.getFullYear() + yearsToAdd, currentDate.getMonth(), currentDate.getDate())
  //   const chainAddress = thornameRegister ? form.getFieldValue('chainAddress') : form.getFieldValue('aliasAddress')
  //   const owner = balance.walletAddress
  //   if (thorname !== undefined && chain !== undefined && chainAddress !== undefined) {
  //     const fetchThornameQuote = async () => {
  //       try {
  //         const params: QuoteThornameParams = {
  //           thorname,
  //           chain,
  //           chainAddress,
  //           owner,
  //           preferredAsset,
  //           expirity: expirity,
  //           isUpdate: thornameUpdate || isOwner
  //         }

  //         const thornameQuote = await thorchainQuery.estimateThorname(params)

  //         if (thornameQuote) {
  //           setMemo(thornameQuote.memo)
  //           setAmountToSend(thornameQuote.value.baseAmount)
  //           setThornameQuoteValid(true)
  //         }
  //       } catch (error) {
  //         console.error('Error fetching fetchThornameQuote:', error)
  //       }
  //     }
  //     fetchThornameQuote()
  //   }
  // }, [balance.walletAddress, form, isOwner, preferredAsset, thorchainQuery, thornameRegister, thornameUpdate])

  // const handleRadioAssetChange = useCallback((e: RadioChangeEvent) => {
  //   const asset = e.target.value
  //   setPreferredAsset(asset)
  // }, [])

  // const handleRadioChainChange = useCallback((e: RadioChangeEvent) => {
  //   const chain = e.target.value
  //   setAliasChain(chain)
  // }, [])

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
    const mayaAddress = form.getFieldValue('mayaAddress')
    const providerAddress =
      form.getFieldValue('providerAddress') === undefined ? undefined : form.getFieldValue('providerAddress')
    const nodeOperatorFee = form.getFieldValue('operatorFee')
    const feeInBasisPoints = nodeOperatorFee ? nodeOperatorFee * 100 : undefined

    let createMemo = ''

    switch (interactType) {
      case 'bond': {
        createMemo = getBondMemo(mayaAddress, providerAddress, feeInBasisPoints)
        break
      }
      case 'unbond': {
        createMemo = getUnbondMemo(mayaAddress, amountToSend, providerAddress)
        break
      }
      case 'leave': {
        createMemo = getLeaveMemo(mayaAddress)
        break
      }
      case 'custom': {
        createMemo = currentMemo
        break
      }
    }
    setMemo(createMemo)
    return createMemo
  }, [amountToSend, currentMemo, form, interactType])

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
        memo: getMemo()
      })
    )
  }, [subscribeInteractState, interactMaya$, walletType, walletAccount, walletIndex, hdMode, amountToSend, getMemo])

  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const reset = useCallback(() => {
    resetInteractState()
    form.resetFields()
    setHasProviderAddress(false)
    setMemo('')
    setAmountToSend(ZERO_BASE_AMOUNT)
    setMayaname(O.none)
    // setIsOwner(false)
    // setMayanameQuoteValid(false)
    // setMayanameUpdate(false)
    // setMayanameAvailable(false)
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
      case 'custom':
        return intl.formatMessage({ id: 'wallet.action.send' })
    }
  }, [interactType, hasProviderAddress, intl])

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
  const onClickHasProviderAddress = useCallback(() => {
    // clean address
    form.setFieldsValue({ providerAddress: undefined })
    form.setFieldsValue({ operatorFee: undefined })
    // toggle
    setHasProviderAddress((v) => !v)
    getMemo()
  }, [form, getMemo])

  useEffect(() => {
    // Whenever `amountToSend` has been updated, we put it back into input field
    form.setFieldsValue({
      amount: baseToAsset(_amountToSend).amount()
    })
  }, [_amountToSend, form])

  // Reset values whenever interactType has been changed (an user clicks on navigation tab)
  useEffect(() => {
    reset()
    setMemo('')
  }, [interactType, reset])

  const [showDetails, setShowDetails] = useState<boolean>(true)

  const bondBaseAmount = userNodeInfo ? userNodeInfo.bondAmount : baseAmount(0)

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
            {swapMemoDetected && <div className="pb-20px text-warning0 dark:text-warning0d ">{affiliateTracking}</div>}
          </Styled.InputContainer>
        )}

        {/* Node address input (BOND/UNBOND/LEAVE only) */}
        {(interactType === 'bond' || interactType === 'unbond' || interactType === 'leave') && (
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
            {(interactType === 'bond' || interactType === 'unbond' || interactType === 'custom') && (
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
                {(interactType === 'bond' || interactType === 'custom') && (
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
                {userNodeInfo && (
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
                          asset: AssetCacao,
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
                  <InputBigNumber disabled={isLoading} size="large" decimal={CACAO_DECIMAL} onChange={onChangeInput} />
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
                      required: true
                    }
                  ]}>
                  <Styled.Input disabled={isLoading} size="large" onChange={() => getMemo()} />
                </Styled.FormItem>
              </Styled.InputContainer>
            )}
          </>
        )}
        {/* Mayaname Button and Details*/}
        {interactType === 'mayaname' && (
          <Styled.InputContainer>
            <div className="flex w-full items-center text-[12px]">
              <Styled.InputLabel>{intl.formatMessage({ id: 'common.mayaname' })}</Styled.InputLabel>
              <InfoIcon className="ml-[3px] h-[15px] w-[15px] text-inherit" color="primary" tooltip={''} />
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
          </Styled.InputContainer>
        )}
        <div>
          {interactType !== 'mayaname' && (
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
      </>
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
                oMayaname,
                O.map(({ owner, expire, entries }) => {
                  if (owner || expire || entries) {
                    return (
                      <>
                        {/* <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div>{intl.formatMessage({ id: 'common.thorname' })}</div>
                          <div>{name}</div>
                        </div> */}
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          {intl.formatMessage({ id: 'common.owner' })}
                          <div>{owner}</div>
                        </div>
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div>{intl.formatMessage({ id: 'common.expirationBlock' })}</div>
                          <div>{expire}</div>
                        </div>

                        {entries &&
                          entries.map((entry, index) => (
                            <div key={index}>
                              <div className="flex w-full justify-between pl-10px text-[12px]">
                                {intl.formatMessage({ id: 'common.aliasChain' })}
                                <div>{entry.chain}</div>
                              </div>
                              <div className="flex w-full justify-between pl-10px text-[12px]">
                                {intl.formatMessage({ id: 'common.aliasAddress' })}
                                <div>{entry.address}</div>
                              </div>
                            </div>
                          ))}
                        {/* <div className="flex w-full justify-between pl-10px text-[12px]">
                          {intl.formatMessage({ id: 'common.preferredAsset' })}
                          <div>{preferredAsset}</div>
                        </div> */}
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

              <div className="ml-[-2px] flex w-full items-start pt-10px font-mainBold text-[14px]">
                {intl.formatMessage({ id: 'common.memo' })}
              </div>
              <div className="truncate pl-10px font-main text-[12px]">{memoLabel}</div>
            </>
          )}
        </div>
      </div>
      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </Styled.Form>
  )
}
