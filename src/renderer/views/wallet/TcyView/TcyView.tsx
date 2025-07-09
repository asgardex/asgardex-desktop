import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { AssetTCY } from '@xchainjs/xchain-thorchain'
import {
  Address,
  assetToBase,
  BaseAmount,
  baseToAsset,
  formatAssetAmountCurrency,
  assetAmount
} from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { filter } from 'fp-ts/Array'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { combineLatest, Observable, of } from 'rxjs'
import { map } from 'rxjs/operators'

import { WalletPasswordConfirmationModal } from '../../../components/modal/confirmation'
import { TxModal } from '../../../components/modal/tx'
import { SendAsset } from '../../../components/modal/tx/extra/SendAsset'
import { AssetData } from '../../../components/uielements/assets/assetData'
import { FlatButton, RefreshButton } from '../../../components/uielements/button'
import { Tooltip } from '../../../components/uielements/common/Common.styles'
import { InputBigNumber } from '../../../components/uielements/input'
import { Slider } from '../../../components/uielements/slider'
import { AssetsNav } from '../../../components/wallet/assets'
import { getInteractiveDescription } from '../../../components/wallet/txs/interact/Interact.helpers'
import { validateTxAmountInput } from '../../../components/wallet/txs/TxForm.util'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { getClaimMemo, getStakeMemo, getUnstakeMemo } from '../../../helpers/memoHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { filterWalletBalancesByAssets } from '../../../helpers/walletHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../services/chain/types'
import { WalletBalances } from '../../../services/clients'
import { INITIAL_INTERACT_STATE } from '../../../services/thorchain/const'
import { InteractState, TcyClaim, TcyStakeLD } from '../../../services/thorchain/types'
import { balancesState$ } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { TcyClaimModal } from './TcyClaimModal'
import { TcyInfo, TcyOperation } from './types'

const tcyTabs = [TcyOperation.Claim, TcyOperation.Stake, TcyOperation.Unstake]

const tabTitle = {
  [TcyOperation.Claim]: 'tcy.claim',
  [TcyOperation.Stake]: 'tcy.stake',
  [TcyOperation.Unstake]: 'tcy.unstake'
}

export const TcyView = () => {
  const { network } = useNetwork()
  const [activeTab, setActiveTab] = useState(TcyOperation.Claim)
  const [selectedAsset, setSelectedAsset] = useState<TcyInfo>()
  const [isClaimModalVisible, setClaimModalVisible] = useState(false)
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false)
  const { interact$, reloadTcyClaim, getTcyClaim$, getTcyStaker$, reloadTcyStaker, fees$ } = useThorchainContext()
  const [currentMemo, setCurrentMemo] = useState<string>('')

  const [thorAddress, setThorAddress] = useState<Address>('')

  const intl = useIntl()
  const {
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [balancesState] = useObservableState(
    () =>
      balancesState$({
        ...DEFAULT_BALANCES_FILTER
      }),
    INITIAL_BALANCES_STATE
  )
  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const { balances: oWalletBalances } = balancesState

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const allBalances: WalletBalances = useMemo(() => {
    const chains = ['ETH', 'BTC', 'LTC', 'BCH', 'DOGE', 'GAIA', 'THOR'] as const
    return FP.pipe(
      oWalletBalances,
      O.map((balances) => filterWalletBalancesByAssets(balances, chains.map(getChainAsset))),
      O.getOrElse<WalletBalances>(() => [])
    )
  }, [oWalletBalances])

  const tcyBalance: WalletBalances = useMemo(() => {
    return FP.pipe(
      oWalletBalances,
      O.map((balances) => filterWalletBalancesByAssets(balances, [AssetTCY])),
      O.getOrElse<WalletBalances>(() => [])
    )
  }, [oWalletBalances])

  const tcyClaims$ = useMemo((): Observable<RD.RemoteData<Error, TcyClaim[]>> => {
    if (allBalances.length === 0) {
      return of(RD.initial)
    }

    const uniqueBalances = Array.from(new Map(allBalances.map((item) => [item.walletAddress, item])).values())

    return combineLatest(uniqueBalances.map(({ walletAddress }) => getTcyClaim$(walletAddress))).pipe(
      map((rds) => {
        const successes = filter(RD.isSuccess)(rds)
          .map((rd) => rd.value)
          .flat()
        const result = successes.length > 0 ? RD.success(successes) : RD.failure(new Error('No successful claims'))
        return result
      })
    )
  }, [allBalances, getTcyClaim$])

  const tcyClaimPosRD = useObservableState(tcyClaims$, RD.initial)

  const selectedThorAddress = useMemo((): Address | undefined => {
    const thorBalances = allBalances.filter(({ asset }) => asset.chain === 'THOR')
    if (thorBalances.length > 0) {
      const address = thorBalances[0].walletAddress
      setThorAddress(address)
      return address
    }
    return undefined
  }, [allBalances])

  const tcyStakerPos$ = useMemo((): TcyStakeLD => {
    if (!selectedThorAddress) {
      return of(RD.initial)
    }

    return getTcyStaker$(selectedThorAddress).pipe(
      map((rd) => {
        return RD.isSuccess(rd) ? RD.success(rd.value) : RD.failure(new Error('No successful stakes'))
      })
    )
  }, [selectedThorAddress, getTcyStaker$])

  const tcyStakePosRD = useObservableState(tcyStakerPos$, RD.initial)

  const maxAmountToStake = tcyBalance.length > 0 ? tcyBalance[0].amount : ZERO_BASE_AMOUNT
  const maxAmountToUnstake = RD.isSuccess(tcyStakePosRD) ? tcyStakePosRD.value.amount : ZERO_BASE_AMOUNT

  const [_amountToSend, setAmountToSend] = useState<BaseAmount>(ZERO_BASE_AMOUNT)

  const amountToSend = useMemo(() => {
    switch (activeTab) {
      case TcyOperation.Stake:
        return _amountToSend
      case TcyOperation.Unstake:
        return ZERO_BASE_AMOUNT
      case TcyOperation.Claim:
        return ZERO_BASE_AMOUNT
      default:
        return _amountToSend
    }
  }, [_amountToSend, activeTab])

  const amountValidator = useCallback(
    async (_: unknown, value: BigNumber) => {
      // error messages
      const errors = {
        msg1: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeNumber' }),
        msg2: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeGreaterThan' }, { amount: '0' }),
        msg3: intl.formatMessage({ id: 'wallet.errors.amount.shouldBeLessThanBalanceAndFee' })
      }

      const maxAmountByAction =
        activeTab === TcyOperation.Stake
          ? maxAmountToStake
          : activeTab === TcyOperation.Unstake
          ? maxAmountToUnstake
          : ZERO_BASE_AMOUNT

      return validateTxAmountInput({
        input: value,
        maxAmount: baseToAsset(maxAmountByAction),
        errors
      })
    },
    [intl, maxAmountToStake, maxAmountToUnstake, activeTab]
  )
  const onChangeInput = useCallback(
    async (value: BigNumber) => {
      amountValidator(undefined, value)
        .then(() => {
          const newAmountToSend = assetToBase(assetAmount(value, THORCHAIN_DECIMAL))
          setAmountToSend(newAmountToSend)
          if (
            activeTab === TcyOperation.Unstake &&
            RD.isSuccess(tcyStakePosRD) &&
            maxAmountToUnstake.gt(ZERO_BASE_AMOUNT)
          ) {
            // Calculate bps: (input amount / maxAmount) * 10,000
            const inputAssetAmount = baseToAsset(newAmountToSend).amount()
            const maxAssetAmount = baseToAsset(maxAmountToUnstake).amount()
            const bps = inputAssetAmount.div(maxAssetAmount).times(10000).integerValue().toString()
            setCurrentMemo(getUnstakeMemo(bps))
          }
        })
        .catch(() => {})
    },
    [activeTab, amountValidator, maxAmountToUnstake, tcyStakePosRD]
  )

  const refreshHandler = useCallback(async () => {
    reloadTcyClaim()
    reloadTcyStaker()
  }, [reloadTcyClaim, reloadTcyStaker])

  const handleClaim = useCallback((tcyInfo: TcyInfo) => {
    setSelectedAsset(tcyInfo)
    setClaimModalVisible(true)
  }, [])

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)

  const submitStakeTx = useCallback(() => {
    if (tcyBalance.length === 0) return

    const { walletType, walletIndex, walletAccount, hdMode } = tcyBalance[0]

    setSendTxStartTime(Date.now())

    subscribeInteractState(
      interact$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        amount: amountToSend,
        memo: getStakeMemo(),
        asset: AssetTCY
      })
    )
  }, [tcyBalance, setSendTxStartTime, subscribeInteractState, interact$, amountToSend])

  const submitUnStakeTx = useCallback(() => {
    if (tcyBalance.length === 0) return

    const { walletType, walletIndex, walletAccount, hdMode } = tcyBalance[0]

    setSendTxStartTime(Date.now())

    subscribeInteractState(
      interact$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        amount: amountToSend,
        memo: currentMemo,
        asset: AssetTCY
      })
    )
  }, [tcyBalance, subscribeInteractState, interact$, amountToSend, currentMemo])

  const onSuccess = useCallback(() => {
    if (activeTab === TcyOperation.Stake) {
      submitStakeTx()
    } else if (activeTab === TcyOperation.Unstake) {
      submitUnStakeTx()
    } else if (activeTab === TcyOperation.Claim) {
      setClaimModalVisible(false)
      //submitClaimTx()
    }

    setPasswordModalVisible(false)
  }, [activeTab, submitStakeTx, submitUnStakeTx])

  const renderSlider = useMemo(() => {
    // Calculate percentage based on amountToSend and maxAmount
    const percentage =
      RD.isSuccess(tcyStakePosRD) && maxAmountToUnstake.gt(ZERO_BASE_AMOUNT)
        ? (baseToAsset(_amountToSend).amount().toNumber() / baseToAsset(maxAmountToUnstake).amount().toNumber()) * 100
        : 0

    const setAmountToSendFromPercentValue = (percents: number) => {
      if (RD.isSuccess(tcyStakePosRD)) {
        // Calculate basis points (bps) for memo
        const bps = percents * 100
        setCurrentMemo(getUnstakeMemo(bps.toString()))

        // Calculate amount to send based on percentage of maxAmount
        const newAmount = maxAmountToUnstake.times(percents / 100)
        setAmountToSend(newAmount)
      }
    }

    return (
      <Slider
        key={'Tcy Unstake percentage slider'}
        value={percentage}
        onChange={setAmountToSendFromPercentValue}
        tooltipVisible
        tipFormatter={(value) => `${value}%`}
        max={100}
        tooltipPlacement={'top'}
        disabled={isLoading || !RD.isSuccess(tcyStakePosRD) || maxAmountToUnstake.eq(ZERO_BASE_AMOUNT)}
      />
    )
  }, [_amountToSend, isLoading, maxAmountToUnstake, tcyStakePosRD])

  const reset = useCallback(() => {
    resetInteractState()
  }, [resetInteractState])

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
    // const oTxHash = RD.toOption(txRD)
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
        // extraResult={
        //   <ViewTxButton
        //     txHash={oTxHash}
        //     onClick={openExplorerTxUrl}
        //     txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
        //     network={network}
        //   />
        // }
        timerValue={timerValue}
        extra={
          <SendAsset
            asset={{ asset: AssetTCY, amount: amountToSend }}
            network={network}
            description={getInteractiveDescription({ state: interactState, intl })}
          />
        }
      />
    )
  }, [interactState, intl, reset, sendTxStartTime, amountToSend, network])

  return (
    <>
      <div className="flex w-full justify-end pb-20px">
        <RefreshButton onClick={refreshHandler} />
      </div>

      <AssetsNav />

      <div className="relative grid grid-cols-8 gap-2 bg-bg1 dark:bg-bg1d rounded-b-lg space-x-0 space-y-2 sm:space-x-2 sm:space-y-0 py-8 px-4 sm:px-8">
        <div className="col-span-8 md:col-span-5">
          <div className="flex flex-col py-4 w-full border border-solid border-gray0 dark:border-gray0d rounded-lg ">
            <div className="flex flex-row space-x-4 px-4 pb-4 mb-4 border-b border-solid border-gray0 dark:border-gray0d">
              {tcyTabs.map((tab) => (
                <div key={tab} className="cursor-pointer" onClick={() => setActiveTab(tab)}>
                  <span
                    className={clsx('text-16', activeTab === tab ? 'text-turquoise' : 'text-text2 dark:text-text2d')}>
                    {intl.formatMessage({ id: tabTitle[tab] })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col px-4">
              {activeTab === TcyOperation.Claim && (
                <div>
                  <span className="text-text2 dark:text-text2d text-16">
                    {intl.formatMessage({ id: 'tcy.claimNotice' })}
                  </span>
                  <div className="mt-4 border border-solid border-gray0 dark:border-gray0d rounded-lg">
                    {RD.fold<Error, TcyClaim[], JSX.Element>(
                      () => <span className="text-text2 dark:text-text2d p-4">Loading claims...</span>,
                      () => <span className="text-text2 dark:text-text2d p-4">Fetching claims...</span>,
                      (error) => <span className="text-error0 dark:text-error0d p-4">Error: {error.message}</span>,
                      (claims) => (
                        <div>
                          {claims.length === 0 ? (
                            <span className="text-text2 dark:text-text2d p-4">No claims available</span>
                          ) : (
                            claims.map((tcyData, index) => (
                              <div
                                key={`${tcyData.l1Address || 'claim'}-${index}`}
                                className="flex items-center justify-between px-4 py-2">
                                <div className="flex items-center space-x-2">
                                  <div className="min-w-[120px]">
                                    <AssetData asset={tcyData.asset} network={network} />
                                  </div>
                                  <span className="text-text2 dark:text-text2d">
                                    {formatAssetAmountCurrency({
                                      asset: tcyData.asset,
                                      amount: baseToAsset(tcyData.amount),
                                      trimZeros: true,
                                      decimal: 2
                                    })}
                                  </span>
                                </div>
                                <FlatButton
                                  className="p-2 bg-turquoise text-white cursor-pointer rounded-lg text-11 uppercase"
                                  onClick={() =>
                                    handleClaim({
                                      asset: tcyData.asset,
                                      amount: tcyData.amount,
                                      isClaimed: false,
                                      memo: getClaimMemo(thorAddress)
                                    })
                                  }>
                                  {intl.formatMessage({ id: 'tcy.claim' })}
                                </FlatButton>
                              </div>
                            ))
                          )}
                        </div>
                      )
                    )(tcyClaimPosRD)}
                  </div>
                </div>
              )}
              {activeTab === TcyOperation.Stake && (
                <div className="flex flex-col space-y-2">
                  <span className="text-text2 dark:text-text2d text-16">
                    {intl.formatMessage({ id: 'tcy.stakeNotice' })}
                  </span>
                  <div className="flex items-center justify-between rounded-lg py-2 px-4 border border-gray0 dark:border-gray0d">
                    <div className="flex flex-col">
                      <InputBigNumber
                        value={baseToAsset(_amountToSend).amount()}
                        size="xlarge"
                        ghost
                        decimal={THORCHAIN_DECIMAL}
                        onChange={onChangeInput}
                        // override text style of input for acting as label only
                        className={clsx('w-full !px-0 leading-none text-text0 !opacity-100 dark:text-text0d')}
                      />
                      <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                        {tcyBalance.length > 0
                          ? formatAssetAmountCurrency({
                              asset: AssetTCY,
                              amount: baseToAsset(tcyBalance[0].amount),
                              trimZeros: true,
                              decimal: 2
                            })
                          : 0}
                      </p>
                    </div>
                    <AssetData asset={AssetTCY} network={network} />
                  </div>
                  <FlatButton
                    className="my-30px min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={() => setPasswordModalVisible(true)}>
                    {intl.formatMessage({ id: 'tcy.stake' })}
                  </FlatButton>
                </div>
              )}
              {activeTab === TcyOperation.Unstake && (
                <div className="flex flex-col space-y-2">
                  <span className="text-text2 dark:text-text2d text-16">
                    {intl.formatMessage({ id: 'tcy.unstakeNotice' })}
                  </span>
                  <div className="flex items-center justify-between rounded-lg py-2 px-4 border border-gray0 dark:border-gray0d">
                    <div className="flex flex-col">
                      <InputBigNumber
                        value={baseToAsset(_amountToSend).amount()}
                        size="xlarge"
                        decimal={8}
                        ghost
                        onChange={onChangeInput}
                        // override text style of input for acting as label only
                        className={clsx('w-full !px-0 leading-none text-text0 !opacity-100 dark:text-text0d')}
                      />

                      <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                        {RD.isSuccess(tcyStakePosRD)
                          ? formatAssetAmountCurrency({
                              asset: AssetTCY,
                              amount: baseToAsset(tcyStakePosRD.value.amount),
                              trimZeros: true,
                              decimal: 2
                            })
                          : 0}
                      </p>
                    </div>
                    <AssetData asset={AssetTCY} network={network} />
                  </div>
                  {renderSlider}
                  <FlatButton
                    className="my-30px min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={() => setPasswordModalVisible(true)}>
                    {intl.formatMessage({ id: 'tcy.unstake' })}
                  </FlatButton>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-8 md:col-span-3">
          <div className="flex flex-col py-4 w-full border border-solid border-gray0 dark:border-gray0d rounded-lg">
            <div className="flex flex-row space-x-2 px-4 pb-4 mb-4 border-b border-solid border-gray0 dark:border-gray0d">
              <span className="text-16 text-text2 dark:text-text2d">{intl.formatMessage({ id: 'tcy.status' })}</span>
            </div>

            <div className="flex flex-col space-y-2 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-16 text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'tcy.stakedAmount' })}
                </span>
                <Tooltip title={intl.formatMessage({ id: 'tcy.stakedAmountTooltip' })}>
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>
              <span className="text-turquoise">
                {RD.isSuccess(tcyStakePosRD)
                  ? formatAssetAmountCurrency({
                      asset: AssetTCY,
                      amount: baseToAsset(tcyStakePosRD.value.amount),
                      trimZeros: true,
                      decimal: 2
                    })
                  : 0}
              </span>
            </div>

            <div className="flex flex-col space-y-2 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-16 text-text2 dark:text-text2d">Wallet Balance</span>
                <Tooltip title={intl.formatMessage({ id: 'tcy.walletBalanceTooltip' })}>
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>
              <span className="text-turquoise">
                <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                  {tcyBalance.length > 0
                    ? formatAssetAmountCurrency({
                        asset: AssetTCY,
                        amount: baseToAsset(tcyBalance[0].amount),
                        trimZeros: true,
                        decimal: 2
                      })
                    : 0}
                </p>
              </span>
            </div>
          </div>
        </div>
      </div>
      {selectedAsset && (
        <TcyClaimModal
          isVisible={isClaimModalVisible}
          tcyInfo={selectedAsset}
          onClose={() => setClaimModalVisible(false)}
          feeRd={feeRD}
          onClaim={() => setPasswordModalVisible(true)}
        />
      )}
      {isPasswordModalVisible && (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccess}
          onClose={() => {
            setPasswordModalVisible(false)
          }}
          validatePassword$={validatePassword$}
        />
      )}
      {renderTxModal}
    </>
  )
}
