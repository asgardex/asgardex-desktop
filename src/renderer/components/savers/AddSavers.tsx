import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { CryptoAmount, EstimateAddSaver, ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import {
  Address,
  Asset,
  assetAmount,
  BaseAmount,
  baseAmount,
  assetToBase,
  formatAssetAmountCurrency,
  baseToAsset,
  eqAsset,
  delay
} from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import debounce from 'lodash/debounce'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { Network } from '../../../shared/api/types'
import { chainToString } from '../../../shared/utils/chain'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { isChainAsset, isEthAsset, isUSDAsset, max1e8BaseAmount } from '../../helpers/assetHelper'
import { getChainAsset, isEthChain } from '../../helpers/chainHelper'
import { unionAssets } from '../../helpers/fp/array'
import { eqBaseAmount } from '../../helpers/fp/eq'
import { sequenceTOption } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { liveData } from '../../helpers/rx/liveData'
import { emptyString, hiddenString, loadingString, noDataString } from '../../helpers/stringHelper'
import {
  filterWalletBalancesByAssets,
  getWalletBalanceByAssetAndWalletType,
  hasLedgerInBalancesByAsset
} from '../../helpers/walletHelper'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import { INITIAL_ASYM_DEPOSIT_STATE } from '../../services/chain/const'
import {
  AsymDepositFees,
  AsymDepositFeesHandler,
  AsymDepositFeesRD,
  AsymDepositParams,
  AsymDepositState,
  AsymDepositStateHandler,
  ReloadAsymDepositFeesHandler
} from '../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../services/clients'
import { PoolAddress } from '../../services/midgard/types'
import { BalancesState, KeystoreState, ValidatePasswordHandler, WalletBalance } from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { AssetWithAmount } from '../../types/asgardex'
import { PricePool } from '../../views/pools/Pools.types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../modal/confirmation'
import { TxModal } from '../modal/tx'
import { DepositAsset } from '../modal/tx/extra/DepositAsset'
import { AssetInput } from '../uielements/assets/assetInput'
import { BaseButton, FlatButton, ViewTxButton } from '../uielements/button'
import { MaxBalanceButton } from '../uielements/button/MaxBalanceButton'
import { Tooltip, TooltipAddress } from '../uielements/common/Common.styles'
import { InfoIcon } from '../uielements/info'
import * as Utils from './Saver.utils'

export const ASSET_SELECT_BUTTON_WIDTH = 'w-[180px]'

export type AddProps = {
  keystore: KeystoreState
  poolAssets: Asset[]
  poolDetails: PoolDetails
  asset: CryptoAmount
  address: Address
  network: Network
  pricePool: PricePool
  poolAddress: O.Option<PoolAddress>
  fees$: AsymDepositFeesHandler
  sourceWalletType: WalletType
  onChangeAsset: ({ source, sourceWalletType }: { source: Asset; sourceWalletType: WalletType }) => void
  walletBalances: Pick<BalancesState, 'balances' | 'loading'>
  saverDeposit$: AsymDepositStateHandler
  goToTransaction: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  reloadSelectedPoolDetail: (delay?: number) => void
  validatePassword$: ValidatePasswordHandler
  reloadFees: ReloadAsymDepositFeesHandler
  reloadBalances: FP.Lazy<void>
  hidePrivateData: boolean
}

export const AddSavers: React.FC<AddProps> = (props): JSX.Element => {
  const {
    keystore,
    poolAssets,
    poolDetails,
    asset,
    sourceWalletType: initialSourceWalletType,
    walletBalances,
    network,
    pricePool,
    poolAddress: oPoolAddress,
    onChangeAsset,
    fees$,
    saverDeposit$,
    validatePassword$,
    reloadBalances,
    reloadSelectedPoolDetail,
    goToTransaction,
    getExplorerTxUrl,
    hidePrivateData
  } = props

  const intl = useIntl()

  // For normal quotes
  const [oSaversQuote, setSaversQuote] = useState<O.Option<EstimateAddSaver>>(O.none)

  const { chain: sourceChain } = asset.asset

  const lockedWallet: boolean = useMemo(() => isLocked(keystore) || !hasImportedKeystore(keystore), [keystore])

  const useLedger = isLedgerWallet(initialSourceWalletType)

  // Deposit start time
  const [depositStartTime, setDepositStartTime] = useState<number>(0)

  const {
    state: depositState,
    reset: resetDepositState,
    subscribe: subscribeDepositState
  } = useSubscriptionState<AsymDepositState>(INITIAL_ASYM_DEPOSIT_STATE)

  const { balances: oWalletBalances, loading: walletBalancesLoading } = walletBalances
  /**
   * All balances based on available assets
   */
  const allBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oWalletBalances,
        // filter wallet balances to include assets available only including synth balances
        O.map((balances) => filterWalletBalancesByAssets(balances, poolAssets)),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [poolAssets, oWalletBalances]
  )

  const hasLedger = useMemo(() => hasLedgerInBalancesByAsset(asset.asset, allBalances), [asset, allBalances])

  const sourceWalletType: WalletType = useMemo(() => (useLedger ? 'ledger' : 'keystore'), [useLedger])

  // `AssetWB` of source asset - which might be none (user has no balances for this asset or wallet is locked)
  const oSourceAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(allBalances)
    return getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: asset.asset,
      walletType: sourceWalletType
    })
  }, [asset, allBalances, sourceWalletType])

  // User balance for source asset
  const sourceAssetAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oSourceAssetWB,
        O.map(({ amount }) => amount),
        O.getOrElse(() => baseAmount(0, asset.baseAmount.decimal))
      ),
    [oSourceAssetWB, asset]
  )
  /** Balance of source asset converted to <= 1e8 */
  const sourceAssetAmountMax1e8: BaseAmount = useMemo(() => max1e8BaseAmount(sourceAssetAmount), [sourceAssetAmount])

  // source chain asset
  const sourceChainAsset: Asset = useMemo(() => getChainAsset(sourceChain), [sourceChain])

  // User balance for source chain asset
  const sourceChainAssetAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        getWalletBalanceByAssetAndWalletType({
          oWalletBalances,
          asset: sourceChainAsset,
          walletType: sourceWalletType
        }),
        O.map(({ amount }) => amount),
        O.getOrElse(() => baseAmount(0, asset.baseAmount.decimal))
      ),
    [oWalletBalances, asset, sourceChainAsset, sourceWalletType]
  )
  // *********** FEES **************
  const zeroSaverFees: AsymDepositFees = useMemo(() => Utils.getZeroSaverDepositFees(asset.asset), [asset])

  const prevSaverFees = useRef<O.Option<AsymDepositFees>>(O.none)

  const [saverFeesRD] = useObservableState<AsymDepositFeesRD>(
    () =>
      FP.pipe(
        fees$(asset.asset),
        liveData.map((fees) => {
          // store every successfully loaded fees
          prevSaverFees.current = O.some(fees)
          return fees
        })
      ),
    RD.success(zeroSaverFees)
  )

  const saverFees: AsymDepositFees = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.toOption,
        O.alt(() => prevSaverFees.current),
        O.getOrElse(() => zeroSaverFees)
      ),
    [saverFeesRD, zeroSaverFees]
  )

  const initialAmountToSendMax1e8 = useMemo(
    () => baseAmount(0, sourceAssetAmountMax1e8.decimal),
    [sourceAssetAmountMax1e8]
  )

  const [
    /* max. 1e8 decimal */
    amountToSendMax1e8,
    _setAmountToSendMax1e8 /* private - never set it directly, use setAmountToSendMax1e8() instead */
  ] = useState(initialAmountToSendMax1e8)

  const maxAmountToSendMax1e8: BaseAmount = useMemo(() => {
    if (lockedWallet) return assetToBase(assetAmount(10000, sourceAssetAmountMax1e8.decimal))

    return Utils.maxAmountToSendMax1e8({
      asset: asset.asset,
      balanceAmountMax1e8: sourceAssetAmountMax1e8,
      feeAmount: saverFees.asset.inFee
    })
  }, [lockedWallet, asset, sourceAssetAmountMax1e8, saverFees])

  const setAmountToSendMax1e8 = useCallback(
    (amountToSend: BaseAmount) => {
      const newAmount = baseAmount(amountToSend.amount(), amountToSendMax1e8.decimal)

      // dirty check - do nothing if prev. and next amounts are equal
      if (eqBaseAmount.equals(newAmount, amountToSendMax1e8)) return {}

      const newAmountToSend = newAmount.gt(maxAmountToSendMax1e8) ? amountToSendMax1e8 : newAmount

      _setAmountToSendMax1e8({ ...newAmountToSend })
    },
    [amountToSendMax1e8, maxAmountToSendMax1e8]
  )
  const priceAmountToSendMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: asset.asset, amount: amountToSendMax1e8 },
        poolDetails,
        pricePool,
        network
      }),
      O.getOrElse(() => baseAmount(0, amountToSendMax1e8.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )

    return new CryptoAmount(result.amount, result.asset)
  }, [amountToSendMax1e8, network, poolDetails, pricePool, asset])

  // Reccommend amount in for use later
  const reccommendedAmountIn: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oSaversQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), asset.asset), // default value if oQuote is None
          (txDetails) => new CryptoAmount(baseAmount(txDetails.recommendedMinAmountIn), asset.asset)
        )
      ),
    [oSaversQuote, asset]
  )

  const isZeroAmountToSend = useMemo(() => amountToSendMax1e8.amount().isZero(), [amountToSendMax1e8])
  const minAmountError = useMemo(() => {
    if (isZeroAmountToSend) return false

    return amountToSendMax1e8.lt(reccommendedAmountIn.baseAmount)
  }, [amountToSendMax1e8, isZeroAmountToSend, reccommendedAmountIn])

  const sourceChainFeeError: boolean = useMemo(() => {
    // ignore error check by having zero amounts or min amount errors
    if (minAmountError) return false

    const { inFee } = saverFees.asset

    return inFee.gt(sourceChainAssetAmount)
  }, [minAmountError, sourceChainAssetAmount, saverFees])

  // Diables the submit button
  const disableSubmit = useMemo(() => sourceChainFeeError, [sourceChainFeeError])

  const debouncedEffect = useRef(
    debounce((amountToSendMax1e8) => {
      const thorchainQuery = new ThorchainQuery()
      thorchainQuery
        .estimateAddSaver(new CryptoAmount(amountToSendMax1e8, asset.asset))
        .then((quote) => {
          setSaversQuote(O.some(quote)) // Wrapping the quote in an Option
        })
        .catch((error) => {
          console.error('Failed to get quote:', error)
        })
    }, 500)
  )

  useEffect(() => {
    if (!amountToSendMax1e8.eq(baseAmount(0)) && !disableSubmit) {
      debouncedEffect.current(amountToSendMax1e8)
    }
  }, [amountToSendMax1e8, disableSubmit])

  const setAsset = useCallback(
    async (asset: Asset) => {
      // delay to avoid render issues while switching
      await delay(100)

      onChangeAsset({
        source: asset,
        // back to default 'keystore' type
        sourceWalletType: 'keystore'
      })
    },
    [onChangeAsset]
  )
  const reloadFeesHandler = () => {}

  const zeroBaseAmountMax = useMemo(() => baseAmount(0, asset.baseAmount.decimal), [asset])

  const zeroBaseAmountMax1e8 = useMemo(() => max1e8BaseAmount(zeroBaseAmountMax), [zeroBaseAmountMax])

  const maxBalanceInfoTxt = useMemo(() => {
    const balanceLabel = formatAssetAmountCurrency({
      amount: baseToAsset(sourceAssetAmountMax1e8),
      asset: asset.asset,
      decimal: isUSDAsset(asset.asset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSwapMax1e8
      trimZeros: !isUSDAsset(asset.asset)
    })

    const feeLabel = FP.pipe(
      saverFeesRD,
      RD.map(({ asset: { inFee, asset: feeAsset } }) =>
        formatAssetAmountCurrency({
          amount: baseToAsset(inFee),
          asset: feeAsset,
          decimal: isUSDAsset(feeAsset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSwapMax1e8
          trimZeros: !isUSDAsset(feeAsset)
        })
      ),
      RD.getOrElse(() => noDataString)
    )

    return isChainAsset(asset.asset)
      ? intl.formatMessage({ id: 'swap.info.max.balanceMinusFee' }, { balance: balanceLabel, fee: feeLabel })
      : intl.formatMessage({ id: 'swap.info.max.balance' }, { balance: balanceLabel })
  }, [sourceAssetAmountMax1e8, saverFeesRD, asset, intl])

  const oEarnParams: O.Option<AsymDepositParams> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oPoolAddress, oSourceAssetWB, oSaversQuote),
      O.map(([poolAddress, { walletType, walletAddress, walletIndex, hdMode }, saversQuote]) => {
        const result = {
          poolAddress,
          asset: asset.asset,
          amount: amountToSendMax1e8,
          memo: saversQuote.memo,
          walletType,
          sender: walletAddress,
          walletIndex,
          hdMode
        }
        return result
      })
    )
  }, [oSourceAssetWB, amountToSendMax1e8, asset, oSaversQuote, oPoolAddress])

  const onClickUseLedger = useCallback(() => {}, [])

  const txModalExtraContent = useMemo(() => {
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: asset.asset.ticker }),
      intl.formatMessage({ id: 'common.tx.checkResult' })
    ]
    const stepDescription = FP.pipe(
      depositState.deposit,
      RD.fold(
        () => '',
        () =>
          `${intl.formatMessage(
            { id: 'common.step' },
            { current: depositState.step, total: depositState.stepsTotal }
          )}: ${stepDescriptions[depositState.step - 1]}`,
        () => '',
        () => `${intl.formatMessage({ id: 'common.done' })}!`
      )
    )

    return (
      <DepositAsset
        source={O.some({ asset: asset.asset, amount: amountToSendMax1e8 })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [intl, asset, depositState, amountToSendMax1e8, network])

  const onCloseTxModal = useCallback(() => {
    resetDepositState()
    reloadSelectedPoolDetail(5000)
  }, [resetDepositState, reloadSelectedPoolDetail])

  const onFinishTxModal = useCallback(() => {
    onCloseTxModal()
    reloadBalances()
    reloadSelectedPoolDetail(5000)
  }, [onCloseTxModal, reloadBalances, reloadSelectedPoolDetail])

  const renderTxModal = useMemo(() => {
    const { deposit: depositRD, depositTx } = depositState

    // don't render TxModal in initial state
    if (RD.isInitial(depositRD)) return <></>

    // Get timer value
    const timerValue = FP.pipe(
      depositRD,
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
      depositRD,
      RD.fold(
        () => 'deposit.add.state.pending',
        () => 'deposit.add.state.pending',
        () => 'deposit.add.state.error',
        () => 'deposit.add.state.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const extraResult = (
      <div className="flex flex-col items-center justify-between">
        {FP.pipe(depositTx, RD.toOption, (oTxHash) => (
          <ViewTxButton
            className="pb-20px"
            txHash={oTxHash}
            onClick={goToTransaction}
            txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: asset.asset.ticker })}
          />
        ))}
      </div>
    )

    return (
      <TxModal
        title={txModalTitle}
        onClose={onCloseTxModal}
        onFinish={onFinishTxModal}
        startTime={depositStartTime}
        txRD={depositRD}
        timerValue={timerValue}
        extraResult={extraResult}
        extra={txModalExtraContent}
      />
    )
  }, [
    depositState,
    onCloseTxModal,
    onFinishTxModal,
    depositStartTime,
    txModalExtraContent,
    intl,
    goToTransaction,
    getExplorerTxUrl,
    asset.asset.ticker
  ])

  const submitDepositTx = useCallback(() => {
    FP.pipe(
      oEarnParams,
      O.map((earnParams) => {
        // set start time
        setDepositStartTime(Date.now())
        // subscribe to saverDeposit$
        subscribeDepositState(saverDeposit$(earnParams))

        return true
      })
    )
  }, [oEarnParams, subscribeDepositState, saverDeposit$])

  /**
   * Selectable source assets to add to savers.
   *
   * Based on users layer 1 balances.
   * Zero balances are ignored.
   * Duplications of assets are merged.
   */
  const selectableAssets: Asset[] = useMemo(
    () =>
      FP.pipe(
        allBalances,
        // Get assets
        A.map(({ asset }) => asset),
        // Filter assets by matching chain
        A.filter((a) => isChainAsset(a)),
        // Merge duplications
        (assets) => unionAssets(assets)(assets)
      ),
    [allBalances] // Include asset in dependencies if it can change
  )

  type ModalState = 'deposit' | 'approve' | 'none'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')

  const onSubmit = useCallback(() => {
    if (useLedger) {
      setShowLedgerModal('deposit')
    } else {
      setShowPasswordModal('deposit')
    }
  }, [setShowLedgerModal, useLedger]) // Dependencies array inside the useCallback hook

  const renderMinAmount = useMemo(
    () => (
      <div className="flex w-full items-center pl-10px pt-5px">
        <p
          className={`m-0 pr-5px font-main text-[12px] uppercase ${
            minAmountError ? 'dark:error-0d text-error0' : 'text-gray2 dark:text-gray2d'
          }`}>
          {`${intl.formatMessage({ id: 'common.min' })}: ${formatAssetAmountCurrency({
            asset: asset.asset,
            amount: reccommendedAmountIn.assetAmount,
            trimZeros: true
          })}`}
        </p>
        <InfoIcon
          // override color
          className={`${minAmountError ? '' : 'text-gray2 dark:text-gray2d'}`}
          color={minAmountError ? 'error' : 'neutral'}
          tooltip={intl.formatMessage({ id: 'deposit.add.min.info' })}
        />
      </div>
    ),
    [intl, minAmountError, asset, reccommendedAmountIn]
  )

  const renderPasswordConfirmationModal = useMemo(() => {
    if (showPasswordModal === 'none') return <></>

    const onSuccess = () => {
      if (showPasswordModal === 'deposit') submitDepositTx()
      // if (showPasswordModal === 'approve') submitApproveTx()
      setShowPasswordModal('none')
    }
    const onClose = () => {
      setShowPasswordModal('none')
    }

    return (
      <WalletPasswordConfirmationModal onSuccess={onSuccess} onClose={onClose} validatePassword$={validatePassword$} />
    )
  }, [showPasswordModal, submitDepositTx, validatePassword$])

  const renderLedgerConfirmationModal = useMemo(() => {
    if (showLedgerModal === 'none') return <></>

    const onClose = () => {
      setShowLedgerModal('none')
    }

    const onSucceess = () => {
      if (showLedgerModal === 'deposit') setShowPasswordModal('deposit')
      //if (showLedgerModal === 'approve') submitApproveTx()
      setShowLedgerModal('none')
    }

    const chainAsString = chainToString(sourceChain)
    const txtNeedsConnected = intl.formatMessage(
      {
        id: 'ledger.needsconnected'
      },
      { chain: chainAsString }
    )

    const description1 =
      // extra info for ERC20 assets only
      isEthChain(sourceChain) && !isEthAsset(asset.asset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: chainAsString }
          )}`
        : txtNeedsConnected

    const description2 = intl.formatMessage({ id: 'ledger.sign' })

    const oIsDeposit = O.fromPredicate<ModalState>((v) => v === 'deposit')(showLedgerModal)

    const addresses = FP.pipe(
      sequenceTOption(oIsDeposit, oEarnParams),
      O.chain(([_, { poolAddress, sender }]) => {
        const recipient = poolAddress.address
        if (useLedger) return O.some({ recipient, sender })
        return O.none
      })
    )

    return (
      <LedgerConfirmationModal
        onSuccess={onSucceess}
        onClose={onClose}
        visible
        chain={sourceChain}
        network={network}
        description1={description1}
        description2={description2}
        addresses={addresses}
      />
    )
  }, [asset, sourceChain, intl, useLedger, network, oEarnParams, showLedgerModal])

  // Price of asset IN fee
  const oPriceAssetInFee: O.Option<AssetWithAmount> = useMemo(() => {
    const asset = saverFees.asset.asset
    const amount = saverFees.asset.inFee

    return FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset, amount },
        poolDetails,
        pricePool,
        network
      }),
      O.map((amount) => ({ amount, asset: pricePool.asset }))
    )
  }, [network, poolDetails, pricePool, saverFees])

  const priceFeesLabel = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ asset: { inFee, asset: feeAsset } }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(inFee),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
            const price = FP.pipe(
              oPriceAssetInFee,
              O.map(({ amount, asset: priceAsset }) =>
                eqAsset(feeAsset, priceAsset)
                  ? emptyString
                  : formatAssetAmountCurrency({
                      amount: baseToAsset(amount),
                      asset: priceAsset,
                      decimal: isUSDAsset(priceAsset) ? 2 : 6,
                      trimZeros: !isUSDAsset(priceAsset)
                    })
              ),
              O.getOrElse(() => emptyString)
            )

            return price ? `${price} (${fee})` : fee
          }
        )
      ),

    [saverFeesRD, oPriceAssetInFee]
  )

  const priceInFeeLabel = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ asset: { inFee, asset: feeAsset } }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(inFee),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
            const price = FP.pipe(
              oPriceAssetInFee,
              O.map(({ amount, asset: priceAsset }) =>
                eqAsset(feeAsset, priceAsset)
                  ? emptyString
                  : formatAssetAmountCurrency({
                      amount: baseToAsset(amount),
                      asset: priceAsset,
                      decimal: isUSDAsset(priceAsset) ? 2 : 6,
                      trimZeros: !isUSDAsset(priceAsset)
                    })
              ),
              O.getOrElse(() => emptyString)
            )

            return price ? `${price} (${fee})` : fee
          }
        )
      ),

    [saverFeesRD, oPriceAssetInFee]
  )

  const oWalletAddress: O.Option<Address> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oSourceAssetWB),
      O.map(([{ walletAddress }]) => walletAddress)
    )
  }, [oSourceAssetWB])

  const [showDetails, setShowDetails] = useState<boolean>(false)

  return (
    <div className="flex w-full max-w-[500px] flex-col justify-between py-[60px]">
      <div>
        <div className="flex flex-col">
          <AssetInput
            className="w-full"
            amount={{ amount: amountToSendMax1e8, asset: asset.asset }}
            priceAmount={{ asset: priceAmountToSendMax1e8.asset, amount: priceAmountToSendMax1e8.baseAmount }}
            assets={selectableAssets}
            network={network}
            onChangeAsset={setAsset}
            onChange={setAmountToSendMax1e8}
            onBlur={reloadFeesHandler}
            showError={minAmountError}
            hasLedger={hasLedger}
            useLedger={useLedger}
            useLedgerHandler={onClickUseLedger}
            extraContent={
              <div className="flex flex-col">
                <MaxBalanceButton
                  className="ml-10px mt-5px"
                  classNameButton="!text-gray2 dark:!text-gray2d"
                  classNameIcon={
                    // show warn icon if maxAmountToSendMax1e8 <= 0
                    maxAmountToSendMax1e8.gt(zeroBaseAmountMax1e8)
                      ? `text-gray2 dark:text-gray2d`
                      : 'text-warning0 dark:text-warning0d'
                  }
                  size="medium"
                  balance={{ amount: maxAmountToSendMax1e8, asset: asset.asset }}
                  onClick={() => setAmountToSendMax1e8(maxAmountToSendMax1e8)}
                  maxInfoText={maxBalanceInfoTxt}
                />
                {minAmountError && renderMinAmount}
              </div>
            }
          />

          <div className="flex flex-col items-center justify-center">
            <FlatButton
              className="my-30px min-w-[200px]"
              size="large"
              color="primary"
              onClick={onSubmit}
              disabled={disableSubmit}>
              {intl.formatMessage({ id: 'common.earn' })}
            </FlatButton>
          </div>

          <div className="w-full px-10px font-main text-[12px] uppercase dark:border-gray1d">
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

            <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
              {/* fees */}
              <div className="flex w-full items-center justify-between font-mainBold">
                <BaseButton
                  disabled={RD.isPending(saverFeesRD) || RD.isInitial(saverFeesRD)}
                  className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                  onClick={reloadFeesHandler}>
                  {intl.formatMessage({ id: 'common.fees.estimated' })}
                  <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                </BaseButton>
                <div>{priceFeesLabel}</div>
              </div>

              {showDetails && (
                <>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.fee.inbound' })}</div>
                    <div>{priceInFeeLabel}</div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
                    <div>
                      {formatAssetAmountCurrency({
                        amount: assetAmount(0),
                        asset: pricePool.asset,
                        decimal: 0
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* addresses */}
              {showDetails && (
                <>
                  <div className={`w-full pt-10px font-mainBold text-[14px]`}>
                    {intl.formatMessage({ id: 'common.addresses' })}
                  </div>
                  {/* sender address */}
                  <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.sender' })}</div>
                    <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                      {FP.pipe(
                        oWalletAddress,
                        O.map((address) => (
                          <TooltipAddress title={address} key="tooltip-sender-addr">
                            {address}
                          </TooltipAddress>
                        )),
                        O.getOrElse(() => <>{noDataString}</>)
                      )}
                    </div>
                  </div>
                  {/* inbound address */}
                  {FP.pipe(
                    oEarnParams,
                    O.map(({ poolAddress: { address } }) =>
                      address ? (
                        <div className="flex w-full items-center justify-between pl-10px text-[12px]" key="pool-addr">
                          <div>{intl.formatMessage({ id: 'common.pool.inbound' })}</div>
                          <TooltipAddress title={address}>
                            <div className="truncate pl-20px text-[13px] normal-case leading-normal">{address}</div>
                          </TooltipAddress>
                        </div>
                      ) : null
                    ),
                    O.toNullable
                  )}
                </>
              )}

              {/* balances */}
              {showDetails && (
                <>
                  <div className={`w-full pt-10px text-[14px]`}>
                    <BaseButton
                      disabled={walletBalancesLoading}
                      className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                      onClick={reloadBalances}>
                      {intl.formatMessage({ id: 'common.balances' })}
                      <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                    </BaseButton>
                  </div>
                  {/* sender balance */}
                  <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.sender' })}</div>
                    <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                      {walletBalancesLoading
                        ? loadingString
                        : formatAssetAmountCurrency({
                            amount: baseToAsset(maxAmountToSendMax1e8),
                            asset: asset.asset,
                            decimal: 8,
                            trimZeros: true
                          })}
                    </div>
                  </div>
                </>
              )}
              {/* memo */}
              {showDetails && (
                <>
                  <div className={`w-full pt-10px font-mainBold text-[14px]`}>
                    {intl.formatMessage({ id: 'common.memo' })}
                  </div>
                  <div className="truncate pl-10px font-main text-[12px]">
                    {FP.pipe(
                      oEarnParams,
                      O.map(({ memo }) => (
                        <Tooltip title={memo} key="tooltip-asset-memo">
                          {hidePrivateData ? hiddenString : memo}
                        </Tooltip>
                      )),
                      O.toNullable
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {renderPasswordConfirmationModal}
          {renderLedgerConfirmationModal}
          {renderTxModal}
        </div>
      </div>
    </div>
  )
}
