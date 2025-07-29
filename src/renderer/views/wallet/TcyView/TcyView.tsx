import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { ArchiveBoxXMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { AssetTCY, THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  assetToBase,
  BaseAmount,
  baseToAsset,
  formatAssetAmountCurrency,
  assetAmount,
  baseAmount,
  AnyAsset,
  assetFromStringEx
} from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O, nonEmptyArray as NEA } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { combineLatest, of } from 'rxjs'
import { map, shareReplay, switchMap } from 'rxjs/operators'

import { chainToString, getChainsForDex } from '../../../../shared/utils/chain'
import { WalletType } from '../../../../shared/wallet/types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../../components/modal/confirmation'
import { TxModal } from '../../../components/modal/tx'
import { ClaimAsset } from '../../../components/modal/tx/extra'
import { SendAsset } from '../../../components/modal/tx/extra/SendAsset'
import { AssetData } from '../../../components/uielements/assets/assetData'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { FlatButton, RefreshButton, ViewTxButton } from '../../../components/uielements/button'
import { CheckButton } from '../../../components/uielements/button/CheckButton'
import { Tooltip, WalletTypeLabel, WalletTypeTinyLabel } from '../../../components/uielements/common/Common.styles'
import { InputBigNumber } from '../../../components/uielements/input'
import { Label } from '../../../components/uielements/label'
import { Slider } from '../../../components/uielements/slider'
import { AssetsNav } from '../../../components/wallet/assets'
import { getInteractiveDescription } from '../../../components/wallet/txs/interact/Interact.helpers'
import { validateTxAmountInput } from '../../../components/wallet/txs/TxForm.util'
import { DEFAULT_WALLET_TYPE, ZERO_BASE_AMOUNT } from '../../../const'
import { useChainContext } from '../../../contexts/ChainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { isEvmChainToken } from '../../../helpers/evmHelper'
import { sequenceSOption, sequenceTOption } from '../../../helpers/fpHelpers'
import { getClaimMemo, getStakeMemo, getUnstakeMemo } from '../../../helpers/memoHelper'
import {
  filterWalletBalancesByAssets,
  filterWalletBalancesByAssetsClaimOnly,
  getWalletBalanceByAddressAndAsset
} from '../../../helpers/walletHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { INITIAL_WITHDRAW_STATE } from '../../../services/chain/const'
import { smallestAmountToSend } from '../../../services/chain/transaction/transaction.helper'
import { FeeRD, PoolWithdrawParams, WithdrawState } from '../../../services/chain/types'
import { WalletBalances } from '../../../services/clients'
import { PoolAddress } from '../../../services/midgard/midgardTypes'
import { INITIAL_INTERACT_STATE } from '../../../services/thorchain/const'
import { InteractState, TcyClaim, TcyStakeLD } from '../../../services/thorchain/types'
import { balancesState$ } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { WalletBalance } from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { useApp } from '../../../store/app/hooks'
import { AssetWithAmount1e8 } from '../../../types/asgardex'
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
  const { interact$, reloadTcyClaim, getTcyClaim$, getTcyStaker$, reloadTcyStaker } = useThorchainContext()
  const { depositFees$, poolWithdraw$ } = useChainContext()
  const [currentMemo, setCurrentMemo] = useState<string>('')
  const [hasTcyOnLedger, setHasTcyOnLedger] = useState<boolean>(false)
  const [ledgerIndex, setLedgerIndex] = useState<number>(0)
  const [hasTcyOnKeystore, setHasTcyOnKeystore] = useState<boolean>(false)
  const [keystoreIndex, setKeystoreIndex] = useState<number>(0)
  const [useLedger, setUseLedger] = useState(false)

  const [thorAddress, setThorAddress] = useState<Address>('')
  const [oClaimAssetAmount, setClaimAssetAmount] = useState<O.Option<AssetWithAmount1e8>>(O.none)
  const [claimAddress, setClaimAddress] = useState<O.Option<Address>>(O.none)
  const { protocol } = useApp()

  const {
    service: {
      pools: { selectedPoolAddress$ },
      setSelectedPoolAsset
    }
  } = useMidgardContext()

  useEffect(() => {
    FP.pipe(
      oClaimAssetAmount,
      O.fold(
        () => setSelectedPoolAsset(O.none),
        (asset) => {
          setSelectedPoolAsset(O.some(asset.asset))
        }
      )
    )
    return () => {
      setSelectedPoolAsset(O.none)
    }
  }, [setSelectedPoolAsset, oClaimAssetAmount])

  const oPoolAddress: O.Option<PoolAddress> = useObservableState(selectedPoolAddress$, O.none)

  const { openExplorerTxUrl: openRuneExplorerTxUrl, getExplorerTxUrl: getRuneExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(protocol)
  )
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(
    FP.pipe(
      oClaimAssetAmount,
      O.map(({ asset }) => asset.chain),
      O.alt(() => O.some(protocol))
    )
  )
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

  const { balances: oWalletBalances } = balancesState

  const {
    state: interactState,
    reset: resetInteractState,
    subscribe: subscribeInteractState
  } = useSubscriptionState<InteractState>(INITIAL_INTERACT_STATE)

  const {
    state: withdrawState,
    reset: resetWithdrawState,
    subscribe: subscribeWithdrawState
  } = useSubscriptionState<WithdrawState>(INITIAL_WITHDRAW_STATE)

  const isLoading = useMemo(() => RD.isPending(interactState.txRD), [interactState.txRD])

  const chainList = getChainsForDex(THORChain)

  const allBalances: WalletBalances = useMemo(() => {
    return FP.pipe(
      oWalletBalances,
      O.map((balances) => filterWalletBalancesByAssetsClaimOnly(balances, chainList.map(getChainAsset))),
      O.getOrElse<WalletBalances>(() => [])
    )
  }, [oWalletBalances, chainList])

  const tcyBalance: WalletBalances = useMemo(() => {
    return FP.pipe(
      oWalletBalances,
      O.map((balances) => {
        const bals = filterWalletBalancesByAssets(balances, [AssetTCY])
        const ledgerHasTcy = bals.some((b) => b.walletType === WalletType.Ledger)
        const ledgerIndex = bals.findIndex((b) => b.walletType === WalletType.Ledger)
        const keystoreHasTcy = bals.some((b) => b.walletType === WalletType.Keystore)
        const keyStoreIndex = bals.findIndex((b) => b.walletType === WalletType.Keystore)
        setHasTcyOnLedger(ledgerHasTcy)
        setLedgerIndex(ledgerIndex)
        setHasTcyOnKeystore(keystoreHasTcy)
        setKeystoreIndex(keyStoreIndex)
        // Store boolean and index if needed, e.g., in state or context
        // For now, just return the balances
        return bals
      }),
      O.getOrElse<WalletBalances>(() => [])
    )
  }, [oWalletBalances])

  const tcyClaims$ = useMemo(() => {
    if (allBalances.length === 0) return of(RD.initial)

    const filteredBalances = allBalances.filter(({ asset }) => !['AVAX', 'BSC', 'BASE', 'XRP'].includes(asset.chain))
    const uniqueBalances = Array.from(new Map(filteredBalances.map((item) => [item.walletAddress, item])).values())

    return combineLatest(
      uniqueBalances.map(({ walletAddress, walletType }) => getTcyClaim$(walletAddress, walletType))
    ).pipe(
      map((rds) => {
        const successes = rds
          .filter(RD.isSuccess)
          .map((rd) => rd.value)
          .flat()
        return successes.length > 0 ? RD.success(successes) : RD.failure(new Error('No successful claims'))
      }),
      shareReplay(1)
    )
  }, [allBalances, getTcyClaim$])
  const tcyClaimPosRD = useObservableState(tcyClaims$, RD.initial)

  const feeRD = useObservableState<FeeRD>(
    useMemo(
      () =>
        FP.pipe(
          tcyClaims$,
          switchMap((claims) =>
            FP.pipe(
              RD.toOption(claims),
              O.chain((claims) => O.fromNullable(claims[0]?.asset)),
              O.fold(() => of(RD.initial), depositFees$)
            )
          )
        ),
      [depositFees$, tcyClaims$]
    ),
    RD.initial
  )
  const selectedThorAddress = useMemo((): Address | undefined => {
    const thorBalances = allBalances.filter(({ asset }) => asset.chain === 'THOR')
    if (thorBalances.length === 0) {
      return undefined
    }
    const address = useLedger ? thorBalances[ledgerIndex]?.walletAddress : thorBalances[keystoreIndex]?.walletAddress
    if (!address) {
      return undefined
    }
    setThorAddress(address)
    return address
  }, [allBalances, keystoreIndex, ledgerIndex, useLedger])

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

  const maxAmountToStake = useMemo(() => {
    const wallet = useLedger
      ? ledgerIndex >= 0 && ledgerIndex < tcyBalance.length
        ? tcyBalance[ledgerIndex]
        : null
      : keystoreIndex >= 0 && keystoreIndex < tcyBalance.length
      ? tcyBalance[keystoreIndex]
      : null
    return wallet ? wallet.amount : ZERO_BASE_AMOUNT
  }, [tcyBalance, useLedger, ledgerIndex, keystoreIndex])
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

  const submitAsymDepositTx = useCallback(() => {
    const oAssetWB: O.Option<WalletBalance> = FP.pipe(
      sequenceTOption(oClaimAssetAmount, claimAddress),
      O.chain(([{ asset }, address]) =>
        FP.pipe(
          NEA.fromArray(allBalances),
          O.chain((nonEmptyBalances) =>
            getWalletBalanceByAddressAndAsset({
              balances: nonEmptyBalances,
              asset,
              address
            })
          )
        )
      )
    )

    const oClaimDepositParams: O.Option<PoolWithdrawParams> = FP.pipe(
      sequenceSOption({ poolAddress: oPoolAddress, assetWB: oAssetWB }),
      O.map(({ poolAddress, assetWB }) => ({
        poolAddress,
        asset: assetWB.asset,
        amount: smallestAmountToSend(assetWB.asset.chain, network),
        network,
        memo: getClaimMemo(thorAddress),
        walletType: assetWB.walletType,
        sender: assetWB.walletAddress,
        walletAccount: assetWB.walletAccount,
        walletIndex: assetWB.walletIndex,
        hdMode: assetWB.hdMode,
        protocol
      }))
    )

    FP.pipe(
      oClaimDepositParams,
      O.map((params) => {
        setDepositStartTime(Date.now())
        subscribeWithdrawState(poolWithdraw$(params))
        return true
      }),
      O.getOrElse(() => {
        return false
      })
    )
  }, [
    oClaimAssetAmount,
    claimAddress,
    oPoolAddress,
    allBalances,
    network,
    thorAddress,
    protocol,
    subscribeWithdrawState,
    poolWithdraw$
  ])
  const refreshHandler = useCallback(async () => {
    if (activeTab === TcyOperation.Claim) {
      reloadTcyClaim()
    } else if (activeTab === TcyOperation.Stake || activeTab === TcyOperation.Unstake) {
      reloadTcyStaker()
    }
  }, [activeTab, reloadTcyClaim, reloadTcyStaker])

  const handleClaim = useCallback((tcyInfo: TcyInfo) => {
    setSelectedAsset(tcyInfo)
    const assetAmount: AssetWithAmount1e8 = {
      asset: tcyInfo.asset,
      amount1e8: tcyInfo.amount
    }
    setUseLedger(tcyInfo.walletType === WalletType.Ledger)
    setClaimAssetAmount(O.some(assetAmount))
    setClaimAddress(O.some(tcyInfo.l1Address))
    setClaimModalVisible(true)
  }, [])

  // Send tx start time
  const [sendTxStartTime, setSendTxStartTime] = useState<number>(0)
  // Deposit start time
  const [depositStartTime, setDepositStartTime] = useState<number>(0)

  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false)

  const getTxAssetAndAmount = (
    activeTab: TcyOperation,
    oClaimAssetAmount: O.Option<AssetWithAmount1e8>,
    amountToSend: BaseAmount
  ): { asset: AnyAsset; amount1e8: BaseAmount } => {
    if (activeTab === TcyOperation.Claim) {
      return FP.pipe(
        oClaimAssetAmount,
        O.getOrElse(() => ({
          asset: AssetTCY as AnyAsset,
          amount1e8: baseAmount(0, THORCHAIN_DECIMAL)
        }))
      )
    }
    return { asset: AssetTCY, amount1e8: amountToSend }
  }

  const { asset: sourceAsset, amount1e8: sourceAmount } = getTxAssetAndAmount(
    activeTab,
    oClaimAssetAmount,
    amountToSend
  )

  const submitTx = useCallback(
    (memo: string) => {
      if (tcyBalance.length === 0) return

      const wallet = useLedger
        ? ledgerIndex >= 0 && ledgerIndex < tcyBalance.length
          ? tcyBalance[ledgerIndex]
          : null
        : keystoreIndex >= 0 && keystoreIndex < tcyBalance.length
        ? tcyBalance[keystoreIndex]
        : null

      if (!wallet) return

      const { walletType, walletIndex, walletAccount, hdMode } = wallet

      setSendTxStartTime(Date.now())

      subscribeInteractState(
        interact$({
          walletType,
          walletAccount,
          walletIndex,
          hdMode,
          amount: amountToSend,
          memo,
          asset: AssetTCY
        })
      )
    },
    [tcyBalance, useLedger, ledgerIndex, keystoreIndex, subscribeInteractState, interact$, amountToSend]
  )

  const onSuccess = useCallback(() => {
    if (activeTab === TcyOperation.Stake) {
      submitTx(getStakeMemo())
    } else if (activeTab === TcyOperation.Unstake) {
      submitTx(currentMemo)
    } else if (activeTab === TcyOperation.Claim) {
      setClaimModalVisible(false)
      submitAsymDepositTx()
    }

    setPasswordModalVisible(false)
  }, [activeTab, submitTx, currentMemo, submitAsymDepositTx])

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
  // need to separate these
  const resetStake = useCallback(() => {
    resetInteractState()
    reloadTcyStaker()
  }, [resetInteractState, reloadTcyStaker])

  const resetClaim = useCallback(() => {
    resetWithdrawState()
    reloadTcyClaim()
  }, [resetWithdrawState, reloadTcyClaim])

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
        onClose={resetStake}
        onFinish={resetStake}
        startTime={sendTxStartTime}
        txRD={txRDasBoolean}
        extraResult={
          <ViewTxButton
            txHash={oTxHash}
            onClick={openRuneExplorerTxUrl}
            txUrl={FP.pipe(oTxHash, O.chain(getRuneExplorerTxUrl))}
            network={network}
          />
        }
        timerValue={timerValue}
        extra={
          <SendAsset
            asset={{ asset: sourceAsset, amount: sourceAmount }}
            network={network}
            description={getInteractiveDescription({ state: interactState, intl })}
          />
        }
      />
    )
  }, [
    interactState,
    intl,
    resetStake,
    sendTxStartTime,
    openRuneExplorerTxUrl,
    getRuneExplorerTxUrl,
    network,
    sourceAsset,
    sourceAmount
  ])

  const txModalExtraContent = useMemo(() => {
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: sourceAsset.ticker }),
      intl.formatMessage({ id: 'common.tx.checkResult' })
    ]

    const stepDescription = FP.pipe(
      withdrawState.withdraw,
      RD.fold(
        () => '',
        () =>
          `${intl.formatMessage(
            { id: 'common.step' },
            { current: withdrawState.step, total: withdrawState.stepsTotal }
          )}: ${stepDescriptions[withdrawState.step - 1]}`,
        () => '',
        () => `${intl.formatMessage({ id: 'common.done' })}!`
      )
    )

    return (
      <ClaimAsset
        source={O.some({ asset: sourceAsset, amount: sourceAmount })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [intl, sourceAsset, withdrawState.withdraw, withdrawState.step, withdrawState.stepsTotal, sourceAmount, network])

  const renderDepositTxModal = useMemo(() => {
    const { withdraw: withdrawRD, withdrawTx } = withdrawState

    // don't render TxModal in initial state
    if (RD.isInitial(withdrawRD)) return <></>

    // Get timer value
    const timerValue = FP.pipe(
      withdrawRD,
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

    // title
    const txModalTitle = FP.pipe(
      withdrawRD,
      RD.fold(
        () => 'deposit.withdraw.pending',
        () => 'deposit.withdraw.pending',
        () => 'deposit.withdraw.error',
        () => 'deposit.withdraw.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const extraResult = (
      <div className="flex flex-col items-center justify-between">
        {FP.pipe(withdrawTx, RD.toOption, (oTxHash) => (
          <ViewTxButton
            className="pb-5"
            txHash={oTxHash}
            txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: sourceAsset.ticker })}
            onClick={openExplorerTxUrl}
          />
        ))}
      </div>
    )

    return (
      <TxModal
        title={txModalTitle}
        onClose={resetClaim}
        onFinish={resetClaim}
        startTime={depositStartTime}
        txRD={withdrawRD}
        timerValue={timerValue}
        extra={txModalExtraContent}
        extraResult={extraResult}
      />
    )
  }, [
    withdrawState,
    resetClaim,
    depositStartTime,
    txModalExtraContent,
    intl,
    getExplorerTxUrl,
    sourceAsset.ticker,
    openExplorerTxUrl
  ])

  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal

    const onClose = () => {
      setShowLedgerModal(false)
    }

    const onSucceess = () => {
      onSuccess()
      setShowLedgerModal(false)
    }

    const chainAsString = chainToString(sourceAsset.chain)
    const txtNeedsConnected = intl.formatMessage(
      {
        id: 'ledger.needsconnected'
      },
      { chain: chainAsString }
    )

    const description1 =
      // extra info for ERC20 assets only
      isEvmChainToken(sourceAsset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: chainAsString }
          )}`
        : txtNeedsConnected

    const description2 = intl.formatMessage({ id: 'ledger.sign' })

    return (
      <LedgerConfirmationModal
        key="leder-conf-modal"
        network={network}
        onSuccess={onSucceess}
        onClose={onClose}
        visible={visible}
        chain={sourceAsset.chain}
        description1={description1}
        description2={description2}
        addresses={FP.pipe(
          sequenceSOption({ oPoolAddress, claimAddress }),
          O.map(({ oPoolAddress: poolAddress, claimAddress }) => ({
            recipient: poolAddress.address,
            sender: claimAddress
          }))
        )}
      />
    )
  }, [showLedgerModal, sourceAsset, intl, network, oPoolAddress, claimAddress, onSuccess])

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
                  <div className="mt-4">
                    {RD.fold<Error, TcyClaim[], JSX.Element>(
                      () => (
                        <div className="flex flex-col items-center w-full p-4 space-y-2">
                          <ArrowPathIcon className="animate-spin w-8 h-8" />
                          <span className="text-text2 dark:text-text2d px-4">Loading claims...</span>
                        </div>
                      ),
                      () => (
                        <div className="flex flex-col items-center w-full p-4 space-y-2">
                          <ArrowPathIcon className="animate-spin w-8 h-8" />
                          <span className="text-text2 dark:text-text2d px-4">Fetching claims...</span>
                        </div>
                      ),
                      () => (
                        <div className="flex flex-col items-center w-full border border-solid border-warning0 dark:border-warning0d bg-warning0/5 dark:bg-warning0d/5 rounded-lg p-4 space-y-2">
                          <ArchiveBoxXMarkIcon className="text-warning0 dark:text-warning0d w-8 h-8" />
                          <span className="text-text2 dark:text-text2d px-4">Nothing to claim</span>
                        </div>
                      ),
                      (claims) => (
                        <div>
                          {claims.length === 0 ? (
                            <span className="text-text2 dark:text-text2d p-4">No claims available</span>
                          ) : (
                            claims.map((tcyData, index) => (
                              <div
                                key={`${tcyData.l1Address || 'claim'}-${index}`}
                                className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <div className="min-w-[120px]">
                                    <AssetData
                                      asset={
                                        tcyData.l1Address === thorAddress && tcyData.asset.chain !== 'THOR'
                                          ? assetFromStringEx(`${tcyData.asset.chain}/${tcyData.asset.symbol}`)
                                          : tcyData.asset
                                      }
                                      network={network}
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-text2 dark:text-text2d">
                                      {formatAssetAmountCurrency({
                                        asset: AssetTCY,
                                        amount: baseToAsset(tcyData.amount),
                                        trimZeros: true,
                                        decimal: 2
                                      })}
                                    </span>
                                    <WalletTypeTinyLabel>
                                      {walletTypeToI18n(tcyData.walletType, intl)}
                                    </WalletTypeTinyLabel>
                                  </div>
                                </div>
                                <FlatButton
                                  className="p-2 bg-turquoise text-white cursor-pointer rounded-lg text-11 uppercase"
                                  onClick={() =>
                                    handleClaim({
                                      asset: tcyData.asset,
                                      amount: tcyData.amount,
                                      isClaimed: false,
                                      memo: getClaimMemo(thorAddress),
                                      l1Address: tcyData.l1Address ?? '',
                                      walletType: tcyData.walletType
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
                        className="w-full !px-0 leading-none text-text0 !opacity-100 dark:text-text0d"
                        value={baseToAsset(_amountToSend).amount()}
                        size="xlarge"
                        ghost
                        decimal={THORCHAIN_DECIMAL}
                        onChange={onChangeInput}
                      />
                      <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                        {tcyBalance.length > 0
                          ? formatAssetAmountCurrency({
                              asset: AssetTCY,
                              amount: baseToAsset(
                                useLedger ? tcyBalance[ledgerIndex].amount : tcyBalance[keystoreIndex].amount
                              ),
                              trimZeros: true,
                              decimal: 2
                            })
                          : 0}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <AssetIcon asset={AssetTCY} network={network} />
                      <div className="flex flex-col">
                        <Label size="big" textTransform="uppercase" weight="bold">
                          TCY
                        </Label>
                        <WalletTypeTinyLabel textTransform="uppercase" weight="bold">
                          {walletTypeToI18n(
                            useLedger
                              ? tcyBalance[ledgerIndex].walletType
                              : tcyBalance.length > 0
                              ? tcyBalance[keystoreIndex].walletType
                              : DEFAULT_WALLET_TYPE,
                            intl
                          )}
                        </WalletTypeTinyLabel>
                      </div>
                    </div>
                  </div>
                  {hasTcyOnLedger && (
                    <div className="flex w-full justify-end">
                      <CheckButton
                        size="medium"
                        color="neutral"
                        className="rounded-lg bg-gray0 !px-2 py-1 dark:bg-gray0d"
                        checked={useLedger}
                        clickHandler={() => setUseLedger(!useLedger)}>
                        {intl.formatMessage({ id: 'ledger.title' })}
                      </CheckButton>
                    </div>
                  )}
                  <FlatButton
                    className="my-30px min-w-[200px]"
                    size="large"
                    color="primary"
                    disabled={isLoading || tcyBalance.length === 0}
                    onClick={() => (useLedger ? setShowLedgerModal(true) : setPasswordModalVisible(true))}>
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
                    <div className="flex items-center space-x-2">
                      <AssetIcon asset={AssetTCY} network={network} />
                      <div className="flex flex-col">
                        <Label size="big" textTransform="uppercase" weight="bold">
                          TCY
                        </Label>
                        <WalletTypeTinyLabel textTransform="uppercase" weight="bold">
                          {walletTypeToI18n(
                            useLedger
                              ? tcyBalance[ledgerIndex].walletType
                              : tcyBalance.length > 0
                              ? tcyBalance[keystoreIndex].walletType
                              : DEFAULT_WALLET_TYPE,
                            intl
                          )}
                        </WalletTypeTinyLabel>
                      </div>
                    </div>
                  </div>
                  {hasTcyOnLedger && (
                    <div className="flex w-full justify-end">
                      <CheckButton
                        size="medium"
                        color="neutral"
                        className="rounded-lg bg-gray0 !px-2 py-1 dark:bg-gray0d"
                        checked={useLedger}
                        clickHandler={() => setUseLedger(!useLedger)}>
                        {intl.formatMessage({ id: 'ledger.title' })}
                      </CheckButton>
                    </div>
                  )}
                  {renderSlider}
                  <FlatButton
                    className="my-30px min-w-[200px]"
                    size="large"
                    color="primary"
                    disabled={isLoading || !RD.isSuccess(tcyStakePosRD)}
                    onClick={() => (useLedger ? setShowLedgerModal(true) : setPasswordModalVisible(true))}>
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
                <Label className="!w-auto" color="gray" size="big">
                  {intl.formatMessage({ id: 'tcy.stakedAmount' })}
                </Label>
                <Tooltip title={intl.formatMessage({ id: 'tcy.stakedAmountTooltip' })}>
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>
              <Label size="large">
                {RD.isSuccess(tcyStakePosRD)
                  ? formatAssetAmountCurrency({
                      asset: AssetTCY,
                      amount: baseToAsset(tcyStakePosRD.value.amount),
                      trimZeros: true,
                      decimal: 2
                    })
                  : '0 TCY'}
              </Label>
            </div>

            <div className="mt-4 flex flex-col space-y-2 px-4">
              <div className="flex items-center space-x-2">
                <Label className="!w-auto" color="gray" size="big">
                  Wallet Balance
                </Label>
                <Tooltip title={intl.formatMessage({ id: 'tcy.walletBalanceTooltip' })}>
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>

              {/* Warning Message */}
              {!hasTcyOnLedger && !hasTcyOnKeystore ? (
                <Label size="large">{intl.formatMessage({ id: 'deposit.add.error.nobalances' })}</Label>
              ) : null}

              <div className="flex flex-col space-y-1">
                {hasTcyOnLedger && (
                  <div className="flex items-center justify-between">
                    <Label size="large">
                      {tcyBalance.length > 0
                        ? formatAssetAmountCurrency({
                            asset: AssetTCY,
                            amount: baseToAsset(tcyBalance[ledgerIndex].amount),
                            trimZeros: true,
                            decimal: 2
                          })
                        : '0 TCY'}
                    </Label>
                    <WalletTypeLabel>{walletTypeToI18n(tcyBalance[ledgerIndex].walletType, intl)}</WalletTypeLabel>
                  </div>
                )}
                {hasTcyOnKeystore && (
                  <div className="flex items-center justify-between">
                    <Label size="large">
                      {tcyBalance.length > 0
                        ? formatAssetAmountCurrency({
                            asset: AssetTCY,
                            amount: baseToAsset(tcyBalance[keystoreIndex].amount),
                            trimZeros: true,
                            decimal: 2
                          })
                        : '0 TCY'}
                    </Label>
                    <WalletTypeLabel>{walletTypeToI18n(tcyBalance[keystoreIndex].walletType, intl)}</WalletTypeLabel>
                  </div>
                )}
              </div>
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
          onClaim={() => (useLedger ? setShowLedgerModal(true) : setPasswordModalVisible(true))}
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
      {renderDepositTxModal}
      {renderLedgerConfirmationModal}
    </>
  )
}
