import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { THORCHAIN_DECIMAL } from '@xchainjs/xchain-thorchain-query'
import {
  AnyAsset,
  baseAmount,
  BaseAmount,
  baseToAsset,
  Chain,
  formatAssetAmount,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { Col } from 'antd'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { isLedgerWallet } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { getTwoSigfigAssetAmount, to1e8BaseAmount } from '../../../helpers/assetHelper'
import { eqAsset } from '../../../helpers/fp/eq'
import { getWithdrawMemo } from '../../../helpers/memoHelper'
import * as PoolHelpers from '../../../helpers/poolHelper'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { INITIAL_WITHDRAW_STATE } from '../../../services/chain/const'
import { getZeroWithdrawFees } from '../../../services/chain/fees'
import {
  WithdrawState,
  SymWithdrawStateHandler,
  ReloadWithdrawFeesHandler,
  SymWithdrawFeesHandler,
  SymWithdrawFeesRD,
  SymWithdrawFees
} from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { PoolsDataMap } from '../../../services/midgard/types'
import { MimirHalt } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { AssetWithDecimal } from '../../../types/asgardex'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../modal/confirmation'
import { TxModal } from '../../modal/tx'
import { DepositAssets } from '../../modal/tx/extra'
import { FlatButton } from '../../uielements/button'
import { Tooltip, TooltipAddress } from '../../uielements/common/Common.styles'
import { Fees, UIFeesRD } from '../../uielements/fees'
import { CopyLabel } from '../../uielements/label'
import * as Helper from './Withdraw.helper'
import * as Styled from './Withdraw.styles'

export type Props = {
  asset: AssetWithDecimal
  assetWalletAddress: WalletAddress
  /** Rune price (base amount) */
  dexPrice: BigNumber
  /** Asset price (base amount) */
  assetPrice: BigNumber
  /** Wallet balance of Rune */
  dexBalance: O.Option<BaseAmount>
  dexWalletAddress: WalletAddress
  /** Selected price asset */
  selectedPriceAsset: AnyAsset
  /** Callback to reload fees */
  reloadFees: ReloadWithdrawFeesHandler
  /**
   * Shares of Rune and selected Asset.
   * Note: Decimal needs to be based on **original asset decimals**
   **/
  shares: { rune: BaseAmount; asset: BaseAmount }
  /** Flag whether form has to be disabled or not */
  disabled?: boolean
  openRuneExplorerTxUrl: OpenExplorerTxUrl
  getRuneExplorerTxUrl: GetExplorerTxUrl
  validatePassword$: ValidatePasswordHandler
  reloadBalances: FP.Lazy<void>
  withdraw$: SymWithdrawStateHandler
  fees$: SymWithdrawFeesHandler
  network: Network
  poolsData: PoolsDataMap
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}

/**
 * Withdraw component
 *
 * Note: It supports sym. withdraw only
 *
 * */
export const Withdraw: React.FC<Props> = ({
  asset: assetWD,
  assetWalletAddress,
  dexPrice,
  dexWalletAddress,
  assetPrice,
  dexBalance: oDexBalance,
  selectedPriceAsset,
  shares: { rune: runeShare, asset: assetShare },
  disabled,
  openRuneExplorerTxUrl,
  getRuneExplorerTxUrl,
  validatePassword$,
  reloadBalances = FP.constVoid,
  reloadFees,
  withdraw$,
  fees$,
  network,
  poolsData,
  haltedChains,
  mimirHalt
}) => {
  const intl = useIntl()

  const { asset, decimal: assetDecimal } = assetWD
  const { chain } = asset

  const protocolAsset = dexWalletAddress.chain === THORChain ? AssetRuneNative : AssetCacao
  const protocolAssetDecimal = dexWalletAddress.chain === THORChain ? THORCHAIN_DECIMAL : CACAO_DECIMAL

  const {
    type: runeWalletType,
    address: runeAddress,
    walletAccount: runeWalletAccount,
    walletIndex: runeWalletIndex,
    hdMode: runeHDMode
  } = dexWalletAddress
  const { type: assetWalletType, address: assetAddress } = assetWalletAddress

  // Disable withdraw in case all or pool actions are disabled
  const disableWithdrawAction = useMemo(
    () =>
      PoolHelpers.disableAllActions({ chain, haltedChains, mimirHalt }) ||
      PoolHelpers.disablePoolActions({ chain, haltedChains, mimirHalt }),
    [chain, haltedChains, mimirHalt]
  )

  const [withdrawPercent, setWithdrawPercent] = useState(disabled ? 0 : 50)

  const zeroWithdrawPercent = useMemo(() => withdrawPercent <= 0, [withdrawPercent])

  const {
    state: withdrawState,
    reset: resetWithdrawState,
    subscribe: subscribeWithdrawState
  } = useSubscriptionState<WithdrawState>(INITIAL_WITHDRAW_STATE)

  const memo = useMemo(() => getWithdrawMemo({ asset, percent: withdrawPercent }), [asset, withdrawPercent])

  const { rune: runeAmountToWithdraw, asset: assetAmountToWithdraw } = Helper.getWithdrawAmounts(
    runeShare,
    assetShare,
    withdrawPercent,
    protocolAssetDecimal
  )

  const zeroWithdrawFees: SymWithdrawFees = useMemo(() => getZeroWithdrawFees(protocolAsset), [protocolAsset])

  const assetPriceToWithdraw1e8 = useMemo(() => {
    // Prices are always `1e8` based,
    // that's why we have to convert `assetAmountToWithdraw` to `1e8` as well
    const assetAmountToWithdraw1e8 = to1e8BaseAmount(assetAmountToWithdraw)
    const priceBN = assetAmountToWithdraw1e8.amount().times(assetPrice)
    return baseAmount(priceBN, 8)
  }, [assetAmountToWithdraw, assetPrice])

  const prevWithdrawFees = useRef<O.Option<SymWithdrawFees>>(O.none)
  const [withdrawFeesRD, setWithdrawFeesRD] = useState<SymWithdrawFeesRD>(RD.success(zeroWithdrawFees))

  const feesObservable = useMemo(
    () =>
      FP.pipe(
        fees$(asset, protocol),
        RxOp.map((fees) => {
          // store every successfully loaded fees
          if (RD.isSuccess(fees)) {
            prevWithdrawFees.current = O.some(fees.value)
          }
          return fees
        })
      ),
    [asset, dex, fees$] // Dependencies
  )

  const withdrawFees: SymWithdrawFees = useMemo(
    () =>
      FP.pipe(
        withdrawFeesRD,
        RD.toOption,
        O.alt(() => prevWithdrawFees.current),
        O.getOrElse(() => zeroWithdrawFees)
      ),
    [withdrawFeesRD, zeroWithdrawFees]
  )
  useEffect(() => {
    const subscription = feesObservable.subscribe({
      next: setWithdrawFeesRD,
      error: (error) => setWithdrawFeesRD(RD.failure(error))
    })

    return () => subscription.unsubscribe()
  }, [feesObservable]) // Depend on the memoized observable

  const isInboundChainFeeError: boolean = useMemo(() => {
    if (zeroWithdrawPercent) return false

    return FP.pipe(
      oDexBalance,
      O.fold(
        () => true,
        (balance) => FP.pipe(withdrawFees.rune, Helper.sumWithdrawFees, balance.lt)
      )
    )
  }, [oDexBalance, withdrawFees.rune, zeroWithdrawPercent])

  const renderInboundChainFeeError = useMemo(() => {
    if (!isInboundChainFeeError) return <></>

    const dexBalance = FP.pipe(
      oDexBalance,
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const msg = intl.formatMessage(
      { id: 'deposit.withdraw.error.feeNotCovered' },
      {
        fee: formatAssetAmountCurrency({
          amount: baseToAsset(Helper.sumWithdrawFees(withdrawFees.rune)),
          asset: protocolAsset,
          trimZeros: true
        }),
        balance: formatAssetAmountCurrency({
          amount: baseToAsset(dexBalance),
          asset: protocolAsset,
          trimZeros: true
        })
      }
    )
    return <Styled.FeeErrorLabel key="fee-error">{msg}</Styled.FeeErrorLabel>
  }, [isInboundChainFeeError, oDexBalance, intl, withdrawFees.rune, protocolAsset])

  const minRuneAmountToWithdraw = useMemo(() => Helper.minRuneAmountToWithdraw(withdrawFees.rune), [withdrawFees.rune])

  const minRuneAmountError = useMemo(
    () => !zeroWithdrawPercent && minRuneAmountToWithdraw.gt(runeAmountToWithdraw),
    [minRuneAmountToWithdraw, runeAmountToWithdraw, zeroWithdrawPercent]
  )

  const minAssetAmountToWithdrawMax1e8 = useMemo(
    () => Helper.minAssetAmountToWithdrawMax1e8({ fees: withdrawFees.asset, asset, assetDecimal, poolsData }),
    [asset, assetDecimal, poolsData, withdrawFees.asset]
  )

  // const minAssetAmountError = useMemo(
  //   () => !zeroWithdrawPercent && minAssetAmountToWithdrawMax1e8.gt(assetAmountToWithdraw),
  //   [assetAmountToWithdraw, minAssetAmountToWithdrawMax1e8, zeroWithdrawPercent]
  // )

  // Withdraw start time
  const [withdrawStartTime, setWithdrawStartTime] = useState<number>(0)

  const txModalExtraContent = useMemo(() => {
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: protocolAsset.ticker }),
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
      <DepositAssets
        target={{ asset, amount: assetAmountToWithdraw }}
        source={O.some({ asset: protocolAsset, amount: runeAmountToWithdraw })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [
    intl,
    protocolAsset,
    withdrawState.withdraw,
    withdrawState.step,
    withdrawState.stepsTotal,
    asset,
    assetAmountToWithdraw,
    runeAmountToWithdraw,
    network
  ])

  const onFinishTxModal = useCallback(() => {
    resetWithdrawState()
    setWithdrawPercent(0)
    reloadBalances()
  }, [reloadBalances, resetWithdrawState, setWithdrawPercent])

  const renderTxModal = useMemo(() => {
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
      <Styled.ExtraContainer>
        {FP.pipe(withdrawTx, RD.toOption, (oTxHash) => (
          <Styled.ViewTxButtonTop
            txHash={oTxHash}
            onClick={openRuneExplorerTxUrl}
            txUrl={FP.pipe(oTxHash, O.chain(getRuneExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: protocolAsset.ticker })}
          />
        ))}
      </Styled.ExtraContainer>
    )

    return (
      <TxModal
        title={txModalTitle}
        onClose={resetWithdrawState}
        onFinish={onFinishTxModal}
        startTime={withdrawStartTime}
        txRD={withdrawRD}
        timerValue={timerValue}
        extraResult={extraResult}
        extra={txModalExtraContent}
      />
    )
  }, [
    withdrawState,
    resetWithdrawState,
    onFinishTxModal,
    withdrawStartTime,
    txModalExtraContent,
    intl,
    openRuneExplorerTxUrl,
    getRuneExplorerTxUrl,
    protocolAsset.ticker
  ])

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)

  const onSubmit = useCallback(() => {
    if (isLedgerWallet(runeWalletType)) {
      setShowLedgerModal(true)
    } else {
      setShowPasswordModal(true)
    }
  }, [runeWalletType])

  const submitWithdrawTx = useCallback(() => {
    // set start time
    setWithdrawStartTime(Date.now())

    subscribeWithdrawState(
      withdraw$({
        network,
        memo,
        walletAddress: runeAddress,
        walletType: runeWalletType,
        walletAccount: runeWalletAccount,
        walletIndex: runeWalletIndex,
        hdMode: runeHDMode,
        protocol: protocolAsset.chain
      })
    )
  }, [
    subscribeWithdrawState,
    withdraw$,
    network,
    memo,
    runeAddress,
    runeWalletType,
    runeWalletAccount,
    runeWalletIndex,
    runeHDMode,
    protocolAsset.chain
  ])

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        withdrawFeesRD,
        RD.map(({ rune: runeFees }) => [{ asset: protocolAsset, amount: Helper.sumWithdrawFees(runeFees) }])
      ),
    [protocolAsset, withdrawFeesRD]
  )

  const reloadFeesHandler = useCallback(() => {
    reloadFees(asset, dex)
  }, [reloadFees, asset, dex])

  // Load fees by every `onMount`
  useEffect(() => {
    reloadFees(asset, dex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderPasswordConfirmationModal = useMemo(() => {
    if (!showPasswordModal) return <></>

    const onSuccess = () => {
      setShowPasswordModal(false)
      submitWithdrawTx()
    }
    const onClose = () => {
      setShowPasswordModal(false)
    }

    return (
      <WalletPasswordConfirmationModal onSuccess={onSuccess} onClose={onClose} validatePassword$={validatePassword$} />
    )
  }, [showPasswordModal, submitWithdrawTx, validatePassword$])

  const renderLedgerConfirmationModal = useMemo(() => {
    if (!showLedgerModal) return <></>

    const onClose = () => {
      setShowLedgerModal(false)
    }

    const onSuccess = () => {
      setShowLedgerModal(false)
      submitWithdrawTx()
    }

    return (
      <LedgerConfirmationModal
        onSuccess={onSuccess}
        onClose={onClose}
        visible
        // we always send withdraw tx using THORCHain only
        chain={THORChain}
        network={network}
        description2={intl.formatMessage({ id: 'ledger.sign' })}
        addresses={O.none}
      />
    )
  }, [intl, network, showLedgerModal, submitWithdrawTx])

  const disabledSubmit = useMemo(
    () => disableWithdrawAction || zeroWithdrawPercent || disabled || minRuneAmountError || isInboundChainFeeError,
    [zeroWithdrawPercent, disabled, minRuneAmountError, isInboundChainFeeError, disableWithdrawAction]
  )

  return (
    <Styled.Container>
      <Styled.Title>{intl.formatMessage({ id: 'deposit.withdraw.sym.title' })}</Styled.Title>
      <Styled.Description>
        {intl.formatMessage({ id: 'deposit.withdraw.choseText' })} (
        <Styled.MinLabel color={minRuneAmountError ? 'error' : 'normal'}>
          {intl.formatMessage({ id: 'common.min' })}:
        </Styled.MinLabel>
        <Styled.MinLabel color={minRuneAmountError ? 'error' : 'normal'}>
          {formatAssetAmountCurrency({
            amount: getTwoSigfigAssetAmount(baseToAsset(minRuneAmountToWithdraw)),
            asset: protocolAsset,
            trimZeros: true
          })}
        </Styled.MinLabel>{' '}
        /{' '}
        <Styled.MinLabel color={'normal'}>
          {formatAssetAmountCurrency({
            amount: baseToAsset(minAssetAmountToWithdrawMax1e8),
            asset,
            trimZeros: true
          })}
        </Styled.MinLabel>
        )
      </Styled.Description>
      <Styled.Slider
        key="asset amount slider"
        value={withdrawPercent}
        onChange={setWithdrawPercent}
        onAfterChange={reloadFeesHandler}
        disabled={disabled || disableWithdrawAction}
        error={minRuneAmountError}
      />
      <Styled.AssetOutputContainer>
        <TooltipAddress title={runeAddress}>
          <Styled.AssetContainer>
            <Styled.AssetIcon asset={protocolAsset} network={network} />
            <Styled.AssetLabel asset={protocolAsset} />
            {isLedgerWallet(runeWalletType) && (
              <Styled.WalletTypeLabel>{intl.formatMessage({ id: 'ledger.title' })}</Styled.WalletTypeLabel>
            )}
          </Styled.AssetContainer>
        </TooltipAddress>
        <Styled.OutputContainer>
          <Styled.OutputLabel>
            {formatAssetAmount({
              amount: getTwoSigfigAssetAmount(baseToAsset(runeAmountToWithdraw)),
              decimal: protocolAssetDecimal,
              trimZeros: true
            })}
          </Styled.OutputLabel>
          {/* show pricing if price asset is different only */}
          {!eqAsset.equals(protocolAsset, selectedPriceAsset) && (
            <Styled.OutputUSDLabel>
              {formatAssetAmountCurrency({
                amount: getTwoSigfigAssetAmount(
                  baseToAsset(baseAmount(runeAmountToWithdraw.amount().times(dexPrice), protocolAssetDecimal))
                ),
                asset: selectedPriceAsset,
                trimZeros: true
              })}
            </Styled.OutputUSDLabel>
          )}
        </Styled.OutputContainer>
      </Styled.AssetOutputContainer>

      <Styled.AssetOutputContainer>
        <TooltipAddress title={assetAddress}>
          <Styled.AssetContainer>
            <Styled.AssetIcon asset={asset} network={network} />
            <Styled.AssetLabel asset={asset} />
            {isLedgerWallet(assetWalletType) && (
              <Styled.WalletTypeLabel>{intl.formatMessage({ id: 'ledger.title' })}</Styled.WalletTypeLabel>
            )}
          </Styled.AssetContainer>
        </TooltipAddress>
        <Styled.OutputContainer>
          <Styled.OutputLabel>
            {formatAssetAmount({
              amount: getTwoSigfigAssetAmount(baseToAsset(assetAmountToWithdraw)),
              decimal: assetDecimal,
              trimZeros: true
            })}
            {/* show pricing if price asset is different only */}
            {!eqAsset.equals(asset, selectedPriceAsset) && (
              <Styled.OutputUSDLabel>
                {formatAssetAmountCurrency({
                  amount: getTwoSigfigAssetAmount(baseToAsset(assetPriceToWithdraw1e8)),
                  asset: selectedPriceAsset,
                  trimZeros: true
                })}
              </Styled.OutputUSDLabel>
            )}
          </Styled.OutputLabel>
        </Styled.OutputContainer>
      </Styled.AssetOutputContainer>

      <Styled.FeesRow gutter={{ lg: 32 }}>
        <Col>
          <Styled.FeeRow>
            <Fees fees={uiFeesRD} reloadFees={reloadFeesHandler} />
          </Styled.FeeRow>
          <Styled.FeeErrorRow>
            <Col>
              <>{renderInboundChainFeeError}</>
            </Col>
          </Styled.FeeErrorRow>
        </Col>
      </Styled.FeesRow>
      <div className="flex flex-col items-center justify-center py-20px">
        <FlatButton className="mb-30px min-w-[200px] px-20px" size="large" onClick={onSubmit} disabled={disabledSubmit}>
          {intl.formatMessage({ id: 'common.withdraw' })}
        </FlatButton>
      </div>
      <div className="w-full pt-10px font-mainBold text-[14px]">{intl.formatMessage({ id: 'common.memos' })}</div>
      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
        <div className="">
          <CopyLabel
            className="whitespace-nowrap pl-0 uppercase text-gray2 dark:text-gray2d"
            label={intl.formatMessage({ id: 'common.transaction.short.rune' }, { dex: protocolAsset.chain })}
            key="memo-copy"
            textToCopy={memo}
          />
        </div>

        <div className="truncate pl-10px font-main text-[12px]">
          <Tooltip
            title={`Alternate position withdraw use custom deposit with this memo ${memo}`}
            key={`tooltip-${protocolAsset.chain}-memo`}>
            {memo}
          </Tooltip>
        </div>
      </div>
      {renderPasswordConfirmationModal}
      {renderLedgerConfirmationModal}
      {renderTxModal}
    </Styled.Container>
  )
}
