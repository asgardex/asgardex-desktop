import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import {
  MagnifyingGlassIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { QuoteTHORNameParams, ThorchainQuery, ThornameDetails } from '@xchainjs/xchain-thorchain-query'
import { AnyAsset, Asset, Chain, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'

import { AssetBTC, AssetDOGE, AssetETH, AssetRuneNative, AssetAVAX } from '../../../../../../shared/utils/asset'
import { isKeystoreWallet, isLedgerWallet } from '../../../../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../../../../shared/wallet/types'
import { AssetUSDT, ZERO_BASE_AMOUNT } from '../../../../../const'
import { useSubscriptionState } from '../../../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../../services/clients'
import { WalletAddress$ } from '../../../../../services/clients/types'
import { INITIAL_INTERACT_STATE } from '../../../../../services/thorchain/const'
import { InteractState, InteractStateHandler, ThorchainLastblockRD } from '../../../../../services/thorchain/types'
import { ValidatePasswordHandler, WalletBalance } from '../../../../../services/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../../modal/confirmation'
import { UnifiedTxModal, getTxTimerValue, txHashRDToBoolean, extractTxHash } from '../../../../modal/tx'
import { BaseButton, FlatButton } from '../../../../uielements/button'
import { CheckButton } from '../../../../uielements/button/CheckButton'
import { Fees, UIFees, UIFeesRD } from '../../../../uielements/fees'
import { InfoIcon } from '../../../../uielements/info'
import { Input } from '../../../../uielements/input'
import { Label } from '../../../../uielements/label'
import { Tooltip } from '../../../../uielements/tooltip'
import { NameDetailsCard } from './NameDetailsCard'
import { QuoteState, estimateExpiry } from './types'

const preferredAssetMap: Record<string, AnyAsset> = {
  [AssetBTC.symbol]: AssetBTC,
  [AssetETH.symbol]: AssetETH,
  [AssetUSDT.symbol]: AssetUSDT
}

type Props = {
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  balance: WalletBalance
  interact$: InteractStateHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  validatePassword$: ValidatePasswordHandler
  thorchainQuery: ThorchainQuery
  network: Network
  fee: FeeRD
  reloadFeesHandler: FP.Lazy<void>
  thorchainLastblock: ThorchainLastblockRD
  addressByChain$: (chain: Chain) => WalletAddress$
}

type Tab = 'lookup' | 'owner' | 'register'

export const THORNameForm = ({
  walletType,
  walletAccount,
  walletIndex,
  hdMode,
  balance,
  interact$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  validatePassword$,
  thorchainQuery,
  network,
  fee: feeRD,
  reloadFeesHandler,
  thorchainLastblock: thorchainLastblockRd,
  addressByChain$
}: Props) => {
  const intl = useIntl()
  const { asset, walletAddress } = balance

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('lookup')

  // Lookup tab state
  const [lookupName, setLookupName] = useState('')
  const [lookupResult, setLookupResult] = useState<O.Option<ThornameDetails>>(O.none)
  const [isLookingUp, setIsLookingUp] = useState(false)

  // Owner tab state
  const [ownerAddress, setOwnerAddress] = useState('')
  const [ownerNames, setOwnerNames] = useState<ThornameDetails[]>([])
  const [isLookingUpOwner, setIsLookingUpOwner] = useState(false)
  const [ownerSearchDone, setOwnerSearchDone] = useState(false)

  // Register tab state
  const [regName, setRegName] = useState('')
  const [regChainAddress, setRegChainAddress] = useState(walletAddress)
  const [regPreferredAsset, setRegPreferredAsset] = useState<string>('')
  const [regAliasChain, setRegAliasChain] = useState('')
  const [regAliasAddress, setRegAliasAddress] = useState('')
  const [regExpiry, setRegExpiry] = useState('1')
  const [nameAvailable, setNameAvailable] = useState(false)
  const [isNewRegistration, setIsNewRegistration] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  // Wallet address for selected alias chain
  const oAliasChainWalletAddress = useObservableState(
    useMemo(() => (regAliasChain ? addressByChain$(regAliasChain) : Rx.of(O.none)), [regAliasChain, addressByChain$]),
    O.none
  )

  const handleUseWalletAddress = useCallback(() => {
    if (O.isSome(oAliasChainWalletAddress)) {
      const { address } = oAliasChainWalletAddress.value
      if (isNewRegistration) {
        setRegChainAddress(address)
      } else {
        setRegAliasAddress(address)
      }
    }
  }, [oAliasChainWalletAddress, isNewRegistration])

  // Quote state (two-phase flow)
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: 'idle' })

  // Tx state
  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)
  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])
  const [sendTxStartTime, setSendTxStartTime] = useState(0)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showDetails, setShowDetails] = useState(true)

  // Lookup handler
  const handleLookup = useCallback(async () => {
    if (!lookupName) return
    setIsLookingUp(true)
    try {
      const details = await thorchainQuery.getThornameDetails(lookupName)
      if (details) {
        setLookupResult(O.some(details))
      }
    } catch (_error) {
      setLookupResult(O.none)
    } finally {
      setIsLookingUp(false)
    }
  }, [lookupName, thorchainQuery])

  // Owner lookup handler
  const handleOwnerLookup = useCallback(async () => {
    if (!ownerAddress) return
    setIsLookingUpOwner(true)
    setOwnerNames([])
    setOwnerSearchDone(false)
    try {
      const names =
        await thorchainQuery.thorchainCache.midgardQuery.midgardCache.midgard.getTHORNameReverseLookup(ownerAddress)
      if (names && names.length > 0) {
        const results = await Promise.allSettled(names.map((n) => thorchainQuery.getThornameDetails(n)))
        const details = results
          .filter(
            (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof thorchainQuery.getThornameDetails>>> =>
              r.status === 'fulfilled'
          )
          .map((r) => r.value)
          .filter((d) => d && !d.error?.length)
        setOwnerNames(details)
      }
    } catch (_error) {
      // no names found
    } finally {
      setIsLookingUpOwner(false)
      setOwnerSearchDone(true)
    }
  }, [ownerAddress, thorchainQuery])

  // Check name availability (register tab)
  const handleCheckName = useCallback(async () => {
    if (!regName) return
    setQuoteState({ status: 'idle' })
    setIsLookingUp(true)
    try {
      const details = await thorchainQuery.getThornameDetails(regName)
      if (details) {
        const available = details.owner === '' || walletAddress === details.owner
        setNameAvailable(available)
        setIsNewRegistration(details.name === '')
        setIsOwner(walletAddress === details.owner)
      }
    } catch (_error) {
      // Name not found = available for registration
      setNameAvailable(true)
      setIsNewRegistration(true)
      setIsOwner(false)
    } finally {
      setIsLookingUp(false)
    }
  }, [regName, thorchainQuery, walletAddress])

  // Get quote (Phase 1)
  const handleGetQuote = useCallback(async () => {
    const currentDate = new Date()
    const chain = isNewRegistration ? THORChain : regAliasChain
    const chainAddress = isNewRegistration ? regChainAddress : regAliasAddress
    const yearsToAdd = parseInt(regExpiry || '1')
    const expiry =
      yearsToAdd === 1
        ? undefined
        : new Date(currentDate.getFullYear() + yearsToAdd, currentDate.getMonth(), currentDate.getDate())

    if (!regName || !chain || !chainAddress) return

    setQuoteState({ status: 'loading' })
    try {
      const params: QuoteTHORNameParams = {
        name: regName,
        chain,
        chainAddress,
        owner: walletAddress,
        preferredAsset: regPreferredAsset ? (preferredAssetMap[regPreferredAsset] as Asset) : undefined,
        expiry,
        isUpdate: isOwner
      }
      const quote = await thorchainQuery.estimateThorname(params)
      if (quote) {
        setQuoteState({
          status: 'success',
          memo: quote.memo,
          amount: quote.value.baseAmount
        })
      } else {
        setQuoteState({ status: 'error', message: intl.formatMessage({ id: 'common.noQuoteReturned' }) })
      }
    } catch (error) {
      setQuoteState({
        status: 'error',
        message: error instanceof Error ? error.message : intl.formatMessage({ id: 'common.quoteFailed' })
      })
    }
  }, [
    regName,
    regAliasChain,
    regAliasAddress,
    regChainAddress,
    regExpiry,
    regPreferredAsset,
    walletAddress,
    isNewRegistration,
    isOwner,
    thorchainQuery,
    intl
  ])

  // Submit tx (Phase 2)
  const submitTx = useCallback(() => {
    if (quoteState.status !== 'success') return
    setSendTxStartTime(Date.now())
    subscribeInteractState(
      interact$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        amount: quoteState.amount,
        memo: quoteState.memo,
        asset
      })
    )
  }, [subscribeInteractState, interact$, walletType, walletAccount, walletIndex, hdMode, quoteState, asset])

  const resetForm = useCallback(() => {
    resetInteractState()
    setQuoteState({ status: 'idle' })
    setNameAvailable(false)
    setIsNewRegistration(false)
    setIsOwner(false)
    setRegName('')
    setRegChainAddress(walletAddress)
    setRegPreferredAsset('')
    setRegAliasChain('')
    setRegAliasAddress('')
    setRegExpiry('1')
    setOwnerNames([])
    setOwnerSearchDone(false)
    setLookupResult(O.none)
  }, [resetInteractState, walletAddress])

  // Reset when switching tabs
  useEffect(() => {
    setQuoteState({ status: 'idle' })
    setNameAvailable(false)
  }, [activeTab])

  // Current block for expiry estimation
  const currentBlock = useMemo(
    () =>
      FP.pipe(
        thorchainLastblockRd,
        RD.toOption,
        O.chain((blocks) => O.fromNullable(blocks.find((b) => b.thorchain))),
        O.map((b) => b.thorchain),
        O.toUndefined
      ),
    [thorchainLastblockRd]
  )

  // Fee display for quote amount
  const quoteFees: UIFeesRD = useMemo(() => {
    if (quoteState.status === 'success') {
      const fees: UIFees = [{ asset: AssetRuneNative, amount: quoteState.amount }]
      return RD.success(fees)
    }
    return FP.pipe(
      feeRD,
      RD.map((fee) => [{ asset: AssetRuneNative, amount: fee }])
    )
  }, [quoteState, feeRD])

  // Confirmation modal
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

  // Tx result modal
  const renderTxModal = useMemo(() => {
    const { txRD } = interactState
    if (RD.isInitial(txRD)) return <></>

    return (
      <UnifiedTxModal
        title={intl.formatMessage({ id: 'common.tx.sending' })}
        onClose={resetForm}
        onFinish={resetForm}
        startTime={sendTxStartTime}
        txRD={txHashRDToBoolean(txRD)}
        timerValue={getTxTimerValue(txRD)}
        txConfig={{
          type: 'interact',
          asset: { asset, amount: quoteState.status === 'success' ? quoteState.amount : ZERO_BASE_AMOUNT }
        }}
        txHash={extractTxHash(txRD)}
        getExplorerTxUrl={getExplorerTxUrl}
        openExplorerTxUrl={openExplorerTxUrl}
        network={network}
      />
    )
  }, [interactState, intl, resetForm, sendTxStartTime, openExplorerTxUrl, getExplorerTxUrl, asset, quoteState, network])

  return (
    <div className="w-full sm:max-w-[630px]">
      {/* Tab navigation */}
      <div className="mb-4 flex border-b border-gray0 dark:border-gray0d">
        <button
          type="button"
          className={`flex items-center gap-1.5 px-4 pb-2 font-main text-[14px] transition-colors ${
            activeTab === 'lookup'
              ? 'border-b-2 border-turquoise text-turquoise'
              : 'text-gray2 hover:text-text0 dark:text-gray2d dark:hover:text-text0d'
          }`}
          onClick={() => setActiveTab('lookup')}>
          <MagnifyingGlassIcon className="h-4 w-4" />
          {intl.formatMessage({ id: 'common.lookupName' })}
        </button>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-4 pb-2 font-main text-[14px] transition-colors ${
            activeTab === 'owner'
              ? 'border-b-2 border-turquoise text-turquoise'
              : 'text-gray2 hover:text-text0 dark:text-gray2d dark:hover:text-text0d'
          }`}
          onClick={() => setActiveTab('owner')}>
          <UserIcon className="h-4 w-4" />
          {intl.formatMessage({ id: 'common.namesByOwner' })}
        </button>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-4 pb-2 font-main text-[14px] transition-colors ${
            activeTab === 'register'
              ? 'border-b-2 border-turquoise text-turquoise'
              : 'text-gray2 hover:text-text0 dark:text-gray2d dark:hover:text-text0d'
          }`}
          onClick={() => setActiveTab('register')}>
          {intl.formatMessage({ id: 'common.registerOrUpdate' })}
        </button>
      </div>

      {/* ═══ LOOKUP TAB ═══ */}
      {activeTab === 'lookup' && (
        <>
          <div className="flex items-center text-[12px]">
            <Label color="input" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'common.thorname' })}
            </Label>
            <InfoIcon
              className="ml-[3px] h-[15px] w-[15px] text-inherit"
              tooltip={intl.formatMessage({ id: 'common.thornameRegistrationSpecifics' })}
              color="primary"
            />
          </div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                value={lookupName}
                onChange={(e) => setLookupName(e.target.value)}
                disabled={isLookingUp}
                size="large"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleLookup()
                  }
                }}
              />
            </div>
            <FlatButton
              className="h-[40px] min-w-[100px]"
              size="normal"
              color="primary"
              disabled={isLookingUp || !lookupName}
              loading={isLookingUp}
              onClick={handleLookup}>
              {intl.formatMessage({ id: 'common.lookup' })}
            </FlatButton>
          </div>

          {/* Lookup result */}
          {FP.pipe(
            lookupResult,
            O.map((details) => (
              <div key={details.name} className="mt-4">
                <NameDetailsCard
                  name={details.name}
                  owner={details.owner}
                  expireBlockHeight={details.expireBlockHeight}
                  estimatedExpiry={estimateExpiry(currentBlock, details.expireBlockHeight)}
                  preferredAsset={details.preferredAsset}
                  aliases={details.aliases}
                  nameLabel={intl.formatMessage({ id: 'common.thorname' })}
                />
              </div>
            )),
            O.toNullable
          )}
        </>
      )}

      {/* ═══ OWNER TAB ═══ */}
      {activeTab === 'owner' && (
        <>
          <Label color="input" size="big" textTransform="uppercase">
            {intl.formatMessage({ id: 'common.ownerAddress' })}
          </Label>
          <Input
            value={ownerAddress}
            onChange={(e) => setOwnerAddress(e.target.value)}
            disabled={isLookingUpOwner}
            size="large"
            placeholder="thor1... or any chain address"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleOwnerLookup()
              }
            }}
          />
          <FlatButton
            className="mt-4 w-full"
            size="large"
            color="primary"
            disabled={isLookingUpOwner || !ownerAddress}
            loading={isLookingUpOwner}
            onClick={handleOwnerLookup}>
            <UserIcon className="mr-2 h-5 w-5" />
            {intl.formatMessage({ id: 'common.findNames' })}
          </FlatButton>

          {ownerSearchDone && !isLookingUpOwner && ownerNames.length === 0 && (
            <div className="mt-4 text-center text-[14px] text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'common.noNamesFound' })}
            </div>
          )}
          {!isLookingUpOwner && ownerNames.length > 0 && (
            <div className="mt-4 space-y-3">
              {ownerNames.map((details) => (
                <NameDetailsCard
                  key={details.name}
                  name={details.name}
                  owner={details.owner}
                  expireBlockHeight={details.expireBlockHeight}
                  estimatedExpiry={estimateExpiry(currentBlock, details.expireBlockHeight)}
                  preferredAsset={details.preferredAsset}
                  aliases={details.aliases}
                  nameLabel={intl.formatMessage({ id: 'common.thorname' })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ REGISTER / UPDATE TAB ═══ */}
      {activeTab === 'register' && (
        <>
          {/* Name input + check */}
          <div className="flex items-center text-[12px]">
            <Label color="input" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'common.thorname' })}
            </Label>
            <InfoIcon
              className="ml-[3px] h-[15px] w-[15px] text-inherit"
              tooltip={intl.formatMessage({ id: 'common.thornameRegistrationSpecifics' })}
              color="primary"
            />
          </div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                value={regName}
                onChange={(e) => {
                  setRegName(e.target.value)
                  setNameAvailable(false)
                  setQuoteState({ status: 'idle' })
                }}
                disabled={isLoading || isLookingUp}
                size="large"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCheckName()
                  }
                }}
              />
            </div>
            <FlatButton
              className="h-[40px] min-w-[100px]"
              size="normal"
              color="primary"
              disabled={isLoading || isLookingUp || !regName}
              loading={isLookingUp}
              onClick={handleCheckName}>
              {intl.formatMessage({ id: 'deposit.interact.actions.checkThorname' })}
            </FlatButton>
          </div>

          {/* Name available — show form */}
          {nameAvailable && (
            <div className="mt-4 rounded-lg border border-gray0 p-5 dark:border-gray0d">
              {isOwner && (
                <div className="mb-4">
                  <CheckButton checked={true} clickHandler={() => {}} disabled={isLoading}>
                    {intl.formatMessage({ id: 'common.isUpdateThorname' })}
                  </CheckButton>
                </div>
              )}

              <div className="space-y-5">
                {/* Preferred Asset (update mode only) */}
                {!isNewRegistration && (
                  <div>
                    <div className="mb-2 font-main-semi-bold text-[12px] text-gray2 uppercase dark:text-gray2d">
                      {intl.formatMessage({ id: 'common.preferredAsset' })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: AssetBTC.symbol, label: 'BTC' },
                        { value: AssetETH.symbol, label: 'ETH' },
                        { value: AssetUSDT.symbol, label: 'USDT' }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`rounded-full border px-4 py-1.5 font-main text-[13px] transition-colors ${
                            regPreferredAsset === item.value
                              ? 'border-turquoise bg-turquoise/10 text-turquoise'
                              : 'border-gray0 text-gray2 hover:border-gray2 dark:border-gray0d dark:text-gray2d dark:hover:border-gray2d'
                          }`}
                          onClick={() => setRegPreferredAsset(item.value)}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alias Chain */}
                <div>
                  <div className="mb-2 font-main-semi-bold text-[12px] text-gray2 uppercase dark:text-gray2d">
                    {intl.formatMessage({ id: 'common.aliasChain' })}
                  </div>
                  {isNewRegistration ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-turquoise bg-turquoise/10 px-4 py-1.5 font-main text-[13px] text-turquoise">
                        THOR
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: AssetAVAX.chain, label: 'AVAX' },
                        { value: AssetBTC.chain, label: 'BTC' },
                        { value: AssetETH.chain, label: 'ETH' },
                        { value: AssetDOGE.chain, label: 'DOGE' }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`rounded-full border px-4 py-1.5 font-main text-[13px] transition-colors ${
                            regAliasChain === item.value
                              ? 'border-turquoise bg-turquoise/10 text-turquoise'
                              : 'border-gray0 text-gray2 hover:border-gray2 dark:border-gray0d dark:text-gray2d dark:hover:border-gray2d'
                          }`}
                          onClick={() => setRegAliasChain(item.value)}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Alias Address */}
                <div>
                  <div className="mb-2 font-main-semi-bold text-[12px] text-gray2 uppercase dark:text-gray2d">
                    {intl.formatMessage({ id: 'common.aliasAddress' })}
                  </div>
                  {isNewRegistration ? (
                    <Input
                      value={regChainAddress}
                      onChange={(e) => setRegChainAddress(e.target.value)}
                      disabled={isLoading}
                      size="large"
                    />
                  ) : (
                    <Input
                      value={regAliasAddress}
                      onChange={(e) => setRegAliasAddress(e.target.value)}
                      disabled={isLoading}
                      size="large"
                    />
                  )}
                  {O.isSome(oAliasChainWalletAddress) && (isNewRegistration || regAliasChain) && (
                    <button
                      type="button"
                      className="mt-1 font-main text-[12px] text-turquoise hover:text-turquoise/80"
                      onClick={handleUseWalletAddress}>
                      {intl.formatMessage({ id: 'common.useWalletAddress' })}
                    </button>
                  )}
                </div>

                {/* Expiry */}
                <div>
                  <div className="mb-2 font-main-semi-bold text-[12px] text-gray2 uppercase dark:text-gray2d">
                    {intl.formatMessage({ id: 'common.expiry' })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: '1', label: '1 year' },
                      { value: '2', label: '2 years' },
                      { value: '3', label: '3 years' },
                      { value: '5', label: '5 years' }
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`rounded-full border px-4 py-1.5 font-main text-[13px] transition-colors ${
                          regExpiry === item.value
                            ? 'border-turquoise bg-turquoise/10 text-turquoise'
                            : 'border-gray0 text-gray2 hover:border-gray2 dark:border-gray0d dark:text-gray2d dark:hover:border-gray2d'
                        }`}
                        onClick={() => setRegExpiry(item.value)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Get Quote button */}
                <FlatButton
                  className="mt-2 w-full"
                  size="large"
                  color="primary"
                  disabled={
                    isLoading ||
                    quoteState.status === 'loading' ||
                    (!isNewRegistration && (!regAliasChain || !regAliasAddress)) ||
                    (isNewRegistration && !regChainAddress)
                  }
                  loading={quoteState.status === 'loading'}
                  onClick={handleGetQuote}>
                  {intl.formatMessage({ id: 'deposit.interact.actions.getQuote' })}
                </FlatButton>
              </div>

              {/* Quote error */}
              {quoteState.status === 'error' && (
                <div className="mt-4 rounded-lg border border-error0 bg-error0/10 p-3 dark:border-error0d dark:bg-error0d/10">
                  <div className="text-[13px] text-error0 dark:text-error0d">{quoteState.message}</div>
                </div>
              )}

              {/* Quote result */}
              {quoteState.status === 'success' && (
                <div className="mt-4 rounded-lg border border-turquoise/30 bg-turquoise/5 p-4">
                  <div className="flex gap-6">
                    <div className="flex-1">
                      <div className="text-[11px] text-gray2 dark:text-gray2d">
                        {intl.formatMessage({ id: 'common.amount' })}
                      </div>
                      <div className="font-main-semi-bold text-[14px] text-text0 dark:text-text0d">
                        {formatAssetAmountCurrency({
                          amount: baseToAsset(quoteState.amount),
                          asset: AssetRuneNative,
                          trimZeros: true
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-[11px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'common.memo' })}
                    </div>
                    <div className="font-mono text-[11px] break-all text-text0 dark:text-text0d">
                      <Tooltip title={quoteState.memo}>{quoteState.memo}</Tooltip>
                    </div>
                  </div>

                  {/* Execute button (Phase 2) */}
                  <FlatButton
                    className="mt-4 w-full"
                    size="large"
                    loading={isLoading}
                    disabled={isLoading}
                    onClick={() => setShowConfirmationModal(true)}>
                    {isOwner
                      ? intl.formatMessage({ id: 'common.isUpdateThorname' })
                      : intl.formatMessage({ id: 'deposit.interact.actions.buyThorname' })}
                  </FlatButton>
                </div>
              )}

              {/* Fees */}
              <Fees className="mt-4" fees={quoteFees} reloadFees={reloadFeesHandler} disabled={isLoading} />
            </div>
          )}

          {/* Name not available */}
          {!nameAvailable && regName && !isLookingUp && quoteState.status === 'idle' && regName.length > 0 && <></>}
        </>
      )}

      {/* Details section — only render when there's a quote */}
      {quoteState.status === 'success' && (
        <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
          <div className="my-20px w-full font-main text-[12px] uppercase dark:border-gray1d">
            <BaseButton
              className="group flex w-full !justify-between !p-0 font-main-semi-bold text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
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
                <div className="ml-[-2px] flex w-full justify-between pt-10px font-main-bold text-[14px]">
                  {intl.formatMessage({ id: 'common.amount' })}
                  <div className="truncate pl-10px font-main text-[12px]">
                    {formatAssetAmountCurrency({
                      amount: baseToAsset(quoteState.amount),
                      asset: AssetRuneNative,
                      trimZeros: true
                    })}
                  </div>
                </div>
                <div className="ml-[-2px] flex w-full justify-between pt-10px font-main-bold text-[14px]">
                  {intl.formatMessage({ id: 'common.memo' })}
                  <div className="overflow pl-10px font-main text-[12px] break-normal">
                    <Tooltip title={quoteState.memo}>{quoteState.memo}</Tooltip>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showConfirmationModal && renderConfirmationModal}
      {renderTxModal}
    </div>
  )
}
