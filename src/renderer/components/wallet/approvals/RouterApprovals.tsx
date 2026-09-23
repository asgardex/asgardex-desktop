import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { Address, BaseAmount, Chain, baseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { Observable, Subscription } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { chainToString } from '../../../../shared/utils/chain'
import { isKeystoreWallet, isLedgerWallet, isVultisigWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { ZERO_BN } from '../../../const'
import { getChainAsset } from '../../../helpers/chainHelper'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { FeeRD } from '../../../services/chain/types'
import {
  AllowanceLD,
  AllowanceParams,
  ApproveFeeHandler,
  ApproveParams,
  LoadApproveFeeHandler
} from '../../../services/evm/types'
import { ApiError, TxHashRD, ValidatePasswordHandler, VaultType, WalletBalances } from '../../../services/wallet/types'
import {
  LedgerConfirmationModal,
  VultisigConfirmationModal,
  WalletPasswordConfirmationModal
} from '../../modal/confirmation'
import { AddressEllipsis } from '../../uielements/addressEllipsis'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { ChainIcon } from '../../uielements/assets/chainIcon'
import { FlatButton, BorderButton, ViewTxButton } from '../../uielements/button'
import { CheckButton } from '../../uielements/button/CheckButton'
import { Dropdown } from '../../uielements/dropdown'
import { Fees, UIFeesRD } from '../../uielements/fees'
import { InputBigNumber } from '../../uielements/input'
import { Label } from '../../uielements/label'
import { ProtocolSwitch } from '../../uielements/protocolSwitch'
import { ProtocolsLp } from '../../uielements/protocolSwitch/types'
import { Spin } from '../../uielements/spin'
import {
  approveBaseAmount,
  EVM_APPROVAL_CHAINS,
  formatAllowance,
  formatChainOptionLabel,
  tokensForChain
} from './RouterApprovals.helper'
import {
  ApprovalProtocol,
  ApprovalTokenOption,
  ApprovalWalletOption,
  FormattedAllowance
} from './RouterApprovals.types'

type PendingAction = 'approve' | 'revoke'

type Props = {
  network: Network
  protocol: ApprovalProtocol
  setProtocol: (p: ApprovalProtocol) => void
  chain: Chain
  setChain: (c: Chain) => void
  walletOptions: ApprovalWalletOption[]
  selectedWallet: O.Option<ApprovalWalletOption>
  setSelectedWalletId: (id: string) => void
  walletBalances: WalletBalances
  oRouterAddress: O.Option<Address>
  getERC20Allowance$: (params: AllowanceParams) => AllowanceLD
  approveERC20Token$: (params: ApproveParams) => Observable<TxHashRD>
  approveFee$: ApproveFeeHandler
  reloadApproveFee: LoadApproveFeeHandler
  openExplorerTxUrl: (txHash: TxHash) => void
  getExplorerTxUrl: (txHash: TxHash) => O.Option<string>
  validatePassword$: ValidatePasswordHandler
  vaultType: VaultType
  isVaultEncrypted: boolean
  getActiveVaultId: () => string | undefined
}

const walletTypeLabel = (walletType: WalletType, intl: ReturnType<typeof useIntl>): string => {
  if (isLedgerWallet(walletType)) return intl.formatMessage({ id: 'common.ledger' })
  if (isVultisigWallet(walletType)) return intl.formatMessage({ id: 'wallet.vultisig' })
  return intl.formatMessage({ id: 'common.keystore' })
}

export const RouterApprovals = ({
  network,
  protocol,
  setProtocol,
  chain,
  setChain,
  walletOptions,
  selectedWallet,
  setSelectedWalletId,
  walletBalances,
  oRouterAddress,
  getERC20Allowance$,
  approveERC20Token$,
  approveFee$,
  reloadApproveFee,
  openExplorerTxUrl,
  getExplorerTxUrl,
  validatePassword$,
  vaultType,
  isVaultEncrypted,
  getActiveVaultId
}: Props): JSX.Element => {
  const intl = useIntl()
  const chainAsset = useMemo(() => getChainAsset(chain), [chain])

  const tokenOptions = useMemo(() => tokensForChain(chain, walletBalances, network), [chain, walletBalances, network])

  const [selectedToken, setSelectedToken] = useState<ApprovalTokenOption | undefined>(tokenOptions[0])
  const [unlimited, setUnlimited] = useState(true)
  const [approveAmount, setApproveAmount] = useState<BigNumber>(ZERO_BN)
  const [allowanceRD, setAllowanceRD] = useState<RD.RemoteData<ApiError, FormattedAllowance>>(RD.initial)
  const [pendingAction, setPendingAction] = useState<O.Option<PendingAction>>(O.none)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [showVultisigModal, setShowVultisigModal] = useState(false)

  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

  const allowanceSubRef = useRef<Subscription | null>(null)
  const allowanceRequestIdRef = useRef(0)

  const cancelAllowanceRequest = useCallback(() => {
    allowanceSubRef.current?.unsubscribe()
    allowanceSubRef.current = null
    allowanceRequestIdRef.current += 1
  }, [])

  // Reset token when chain/token list changes
  useEffect(() => {
    cancelAllowanceRequest()
    setSelectedToken((prev) => {
      if (prev && tokenOptions.some((t) => t.contractAddress === prev.contractAddress)) return prev
      return tokenOptions[0]
    })
    setAllowanceRD(RD.initial)
    resetApproveState()
  }, [tokenOptions, resetApproveState, cancelAllowanceRequest])

  // Clear allowance when wallet changes
  useEffect(() => {
    cancelAllowanceRequest()
    setAllowanceRD(RD.initial)
    resetApproveState()
  }, [selectedWallet, resetApproveState, cancelAllowanceRequest])

  useEffect(
    () => () => {
      cancelAllowanceRequest()
    },
    [cancelAllowanceRequest]
  )

  const walletMeta = selectedWallet
  const canAct = O.isSome(walletMeta) && O.isSome(oRouterAddress) && !!selectedToken

  const oFeeParams: O.Option<ApproveParams> = useMemo(() => {
    if (!selectedToken) return O.none
    return FP.pipe(
      walletMeta,
      O.chain((meta) =>
        FP.pipe(
          oRouterAddress,
          O.map((router) => ({
            network,
            walletType: meta.walletType,
            walletAccount: meta.walletAccount,
            walletIndex: meta.walletIndex,
            hdMode: meta.hdMode,
            fromAddress: meta.fromAddress,
            contractAddress: selectedToken.contractAddress,
            spenderAddress: router
          }))
        )
      )
    )
  }, [selectedToken, walletMeta, oRouterAddress, network])

  const [approveFeeRD, approveFeeParamsUpdated] = useObservableState<FeeRD, ApproveParams>(
    (approveFeeParam$) =>
      approveFeeParam$.pipe(
        RxOp.switchMap((params) => approveFee$(params)),
        RxOp.shareReplay(1)
      ),
    RD.initial
  )

  useEffect(() => {
    FP.pipe(oFeeParams, O.map(approveFeeParamsUpdated))
  }, [oFeeParams, approveFeeParamsUpdated])

  const reloadApproveFeesHandler = useCallback(() => {
    FP.pipe(oFeeParams, O.map(reloadApproveFee))
  }, [oFeeParams, reloadApproveFee])

  const uiApproveFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.map((fee) => [{ asset: chainAsset, amount: fee }])
      ),
    [approveFeeRD, chainAsset]
  )

  const handleCheckAllowance = useCallback(() => {
    if (!selectedToken || O.isNone(walletMeta) || O.isNone(oRouterAddress)) return

    cancelAllowanceRequest()
    const requestId = allowanceRequestIdRef.current
    setAllowanceRD(RD.pending)
    allowanceSubRef.current = getERC20Allowance$({
      contractAddress: selectedToken.contractAddress,
      spenderAddress: oRouterAddress.value,
      fromAddress: walletMeta.value.fromAddress,
      decimals: selectedToken.decimals
    }).subscribe((rd) => {
      // Ignore stale responses after token/wallet/chain change or a newer check
      if (requestId !== allowanceRequestIdRef.current) return

      if (RD.isSuccess(rd)) {
        setAllowanceRD(
          RD.success(
            formatAllowance(
              rd.value,
              intl.formatMessage({ id: 'wallet.approvals.unlimited' }),
              intl.formatMessage({ id: 'wallet.approvals.none' })
            )
          )
        )
        allowanceSubRef.current?.unsubscribe()
        allowanceSubRef.current = null
      } else if (RD.isFailure(rd)) {
        setAllowanceRD(rd)
        allowanceSubRef.current?.unsubscribe()
        allowanceSubRef.current = null
      }
    })
  }, [selectedToken, walletMeta, oRouterAddress, getERC20Allowance$, intl, cancelAllowanceRequest])

  const buildApproveParams = useCallback(
    (amount: BaseAmount | undefined): O.Option<ApproveParams> => {
      if (!selectedToken) return O.none
      return FP.pipe(
        walletMeta,
        O.chain((meta) =>
          FP.pipe(
            oRouterAddress,
            O.map((router) => ({
              network,
              walletType: meta.walletType,
              walletAccount: meta.walletAccount,
              walletIndex: meta.walletIndex,
              hdMode: meta.hdMode,
              fromAddress: meta.fromAddress,
              contractAddress: selectedToken.contractAddress,
              spenderAddress: router,
              ...(amount !== undefined ? { amount } : {})
            }))
          )
        )
      )
    },
    [selectedToken, walletMeta, oRouterAddress, network]
  )

  const submitPendingAction = useCallback(() => {
    if (O.isNone(pendingAction) || !selectedToken) return

    const amount =
      pendingAction.value === 'revoke'
        ? baseAmount(0, selectedToken.decimals)
        : approveBaseAmount(approveAmount, selectedToken.decimals, unlimited)

    FP.pipe(
      buildApproveParams(amount),
      O.map((params) => {
        resetApproveState()
        subscribeApproveState(approveERC20Token$(params))
      })
    )
  }, [
    pendingAction,
    selectedToken,
    approveAmount,
    unlimited,
    buildApproveParams,
    resetApproveState,
    subscribeApproveState,
    approveERC20Token$
  ])

  const openConfirmFor = useCallback(
    (action: PendingAction) => {
      if (O.isNone(walletMeta)) return
      setPendingAction(O.some(action))
      const { walletType } = walletMeta.value
      if (isLedgerWallet(walletType)) {
        setShowLedgerModal(true)
      } else if (isVultisigWallet(walletType)) {
        setShowVultisigModal(true)
      } else {
        setShowPasswordModal(true)
      }
    },
    [walletMeta]
  )

  const handleApproveClick = useCallback(() => {
    if (!selectedToken) return
    if (!unlimited && (approveAmount.isNaN() || approveAmount.lte(0))) return
    openConfirmFor('approve')
  }, [selectedToken, unlimited, approveAmount, openConfirmFor])

  const handleRevokeClick = useCallback(() => {
    if (!selectedToken) return
    openConfirmFor('revoke')
  }, [selectedToken, openConfirmFor])

  const closeConfirmModals = useCallback(() => {
    setShowPasswordModal(false)
    setShowLedgerModal(false)
    setShowVultisigModal(false)
    setPendingAction(O.none)
  }, [])

  const onConfirmSuccess = useCallback(() => {
    // For Vultisig secure vaults, keep modal open for QR flow; still start the tx
    if (!(O.isSome(walletMeta) && isVultisigWallet(walletMeta.value.walletType) && vaultType === 'secure')) {
      setShowPasswordModal(false)
      setShowLedgerModal(false)
      if (!(O.isSome(walletMeta) && isVultisigWallet(walletMeta.value.walletType))) {
        setShowVultisigModal(false)
        setPendingAction(O.none)
      } else if (vaultType === 'fast') {
        setShowVultisigModal(false)
        setPendingAction(O.none)
      }
    }
    submitPendingAction()
  }, [walletMeta, vaultType, submitPendingAction])

  // Close Vultisig modal when tx finishes
  useEffect(() => {
    if (showVultisigModal && (RD.isSuccess(approveState) || RD.isFailure(approveState))) {
      if (vaultType === 'secure' && RD.isSuccess(approveState)) {
        setShowVultisigModal(false)
        setPendingAction(O.none)
      }
    }
  }, [approveState, showVultisigModal, vaultType])

  // Refresh allowance after successful approve/revoke
  useEffect(() => {
    if (RD.isSuccess(approveState)) {
      handleCheckAllowance()
    }
  }, [approveState, handleCheckAllowance])

  const oTxHash: O.Option<TxHash> = useMemo(
    () => (RD.isSuccess(approveState) ? O.some(approveState.value) : O.none),
    [approveState]
  )

  const validatePasswordAsync = useCallback(
    (password: string) =>
      new Promise<boolean>((resolve) => {
        validatePassword$(password).subscribe({
          next: (result) => {
            if (RD.isSuccess(result)) resolve(true)
            else if (RD.isFailure(result)) resolve(false)
          },
          error: () => resolve(false)
        })
      }),
    [validatePassword$]
  )

  const protocolForSwitch = protocol === 'Thorchain' ? 'THOR' : 'MAYA'

  const setProtocolFromSwitch = useCallback(
    (p: string) => {
      if (p === 'THOR' || p === 'Thorchain') setProtocol('Thorchain')
      else setProtocol('Mayachain')
    },
    [setProtocol]
  )

  const selectTriggerClass =
    'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-solid border-gray0 px-3 py-2 font-main text-sm text-text0 dark:border-gray0d dark:text-text0d'

  const selectedWalletType = FP.pipe(
    walletMeta,
    O.map((m) => m.walletType),
    O.getOrElse(() => WalletType.Keystore)
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <Label size="big" textTransform="uppercase" className="mb-1">
          {intl.formatMessage({ id: 'wallet.approvals.title' })}
        </Label>
        <Label color="gray" size="small">
          {intl.formatMessage({ id: 'wallet.approvals.description' })}
        </Label>
      </div>

      <ProtocolSwitch protocol={protocolForSwitch} setProtocol={setProtocolFromSwitch} protocols={ProtocolsLp} />

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label size="small" color="gray" className="mb-1">
            {intl.formatMessage({ id: 'wallet.approvals.chain' })}
          </Label>
          <Dropdown
            trigger={
              <div className={selectTriggerClass}>
                <span className="flex items-center gap-2">
                  <ChainIcon chain={chain} size="small" />
                  <span>{formatChainOptionLabel(chain)}</span>
                </span>
                <ChevronDownIcon className="h-4 w-4 shrink-0" />
              </div>
            }
            options={EVM_APPROVAL_CHAINS.map((c) => (
              <button
                key={c}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-text0 dark:text-text0d"
                onClick={() => setChain(c)}>
                <ChainIcon chain={c} size="small" />
                <span>{formatChainOptionLabel(c)}</span>
              </button>
            ))}
          />
        </div>

        <div>
          <Label size="small" color="gray" className="mb-1">
            {intl.formatMessage({ id: 'wallet.approvals.selectToken' })}
          </Label>
          <Dropdown
            trigger={
              <div className={selectTriggerClass}>
                <span className="flex items-center gap-2">
                  {selectedToken && <AssetIcon asset={selectedToken.asset} size="small" network={network} />}
                  <span>{selectedToken?.ticker ?? '—'}</span>
                </span>
                <ChevronDownIcon className="h-4 w-4 shrink-0" />
              </div>
            }
            options={tokenOptions.map((t) => (
              <button
                key={t.contractAddress}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-text0 dark:text-text0d"
                onClick={() => {
                  cancelAllowanceRequest()
                  setSelectedToken(t)
                  setAllowanceRD(RD.initial)
                }}>
                <AssetIcon asset={t.asset} size="small" network={network} />
                <span>{t.ticker}</span>
              </button>
            ))}
          />
        </div>
      </div>

      {/* Wallet / owner / spender identity */}
      <div className="rounded-lg border border-gray0 p-3 dark:border-gray0d">
        {walletOptions.length > 1 && (
          <div className="mb-3">
            <Label size="small" color="gray" className="mb-1">
              {intl.formatMessage({ id: 'wallet.approvals.selectWallet' })}
            </Label>
            <Dropdown
              trigger={
                <div className={selectTriggerClass}>
                  <span>
                    {O.isSome(walletMeta)
                      ? `${walletTypeLabel(walletMeta.value.walletType, intl)} · ${walletMeta.value.fromAddress.slice(0, 6)}…${walletMeta.value.fromAddress.slice(-4)}`
                      : '—'}
                  </span>
                  <ChevronDownIcon className="h-4 w-4 shrink-0" />
                </div>
              }
              options={walletOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-text0 dark:text-text0d"
                  onClick={() => setSelectedWalletId(opt.id)}>
                  {walletTypeLabel(opt.walletType, intl)} · {opt.fromAddress.slice(0, 10)}…{opt.fromAddress.slice(-6)}
                </button>
              ))}
            />
          </div>
        )}

        <div className="mb-2">
          <Label size="small" color="gray">
            {intl.formatMessage({ id: 'wallet.approvals.wallet' })}
          </Label>
          <Label>{O.isSome(walletMeta) ? walletTypeLabel(walletMeta.value.walletType, intl) : '—'}</Label>
        </div>

        <div className="mb-2">
          <Label size="small" color="gray">
            {intl.formatMessage({ id: 'wallet.approvals.owner' })}
          </Label>
          {O.isSome(walletMeta) ? (
            <AddressEllipsis address={walletMeta.value.fromAddress} chain={chain} network={network} enableCopy />
          ) : (
            <Label>—</Label>
          )}
        </div>

        <div>
          <Label size="small" color="gray">
            {intl.formatMessage({ id: 'wallet.approvals.spender' })} ({protocol === 'Thorchain' ? 'THOR' : 'MAYA'})
          </Label>
          {O.isSome(oRouterAddress) ? (
            <AddressEllipsis address={oRouterAddress.value} chain={chain} network={network} enableCopy />
          ) : (
            <Label color="warning">{intl.formatMessage({ id: 'wallet.approvals.noRouter' })}</Label>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <BorderButton size="medium" disabled={!canAct || RD.isPending(allowanceRD)} onClick={handleCheckAllowance}>
          {RD.isPending(allowanceRD)
            ? intl.formatMessage({ id: 'common.loading' })
            : intl.formatMessage({ id: 'wallet.approvals.check' })}
        </BorderButton>
      </div>

      {RD.isFailure(allowanceRD) && <Label color="error">{allowanceRD.error.msg}</Label>}

      {RD.isSuccess(allowanceRD) && (
        <div className="rounded-lg border border-gray0 p-3 dark:border-gray0d">
          <Label size="small" color="gray">
            {intl.formatMessage({ id: 'wallet.approvals.current' })}
          </Label>
          <Label size="big">
            {allowanceRD.value.formatted}
            {selectedToken &&
            !allowanceRD.value.isUnlimited &&
            allowanceRD.value.formatted !== intl.formatMessage({ id: 'wallet.approvals.none' })
              ? ` ${selectedToken.ticker}`
              : ''}
          </Label>
          <Label size="small" color="gray">
            {intl.formatMessage({ id: 'wallet.approvals.raw' })}: {allowanceRD.value.raw}
          </Label>
        </div>
      )}

      <div className="rounded-lg border border-gray0 p-3 dark:border-gray0d">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Label size="small" color="gray">
            {intl.formatMessage({ id: 'wallet.approvals.amount' })}
          </Label>
          <CheckButton checked={unlimited} clickHandler={setUnlimited} size="small">
            {intl.formatMessage({ id: 'wallet.approvals.unlimited' })}
          </CheckButton>
        </div>

        {!unlimited && (
          <InputBigNumber
            value={approveAmount}
            onChange={setApproveAmount}
            decimal={selectedToken?.decimals ?? 8}
            disabled={!canAct}
            className="mb-3"
          />
        )}

        <Label size="small" color="gray" className="mb-3">
          {intl.formatMessage({ id: 'wallet.approvals.resetWarning' })}
        </Label>

        {RD.isSuccess(allowanceRD) && !allowanceRD.value.amount.amount().isZero() && (
          <Label size="small" color="warning" className="mb-3">
            {intl.formatMessage({ id: 'wallet.approvals.existingAllowanceNote' })}
          </Label>
        )}

        {!RD.isInitial(uiApproveFeesRD) && (
          <div className="mb-3 min-w-0 overflow-hidden">
            <Fees fees={uiApproveFeesRD} reloadFees={reloadApproveFeesHandler} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <FlatButton
            size="medium"
            disabled={!canAct || RD.isPending(approveState) || (!unlimited && approveAmount.lte(0))}
            onClick={handleApproveClick}>
            {RD.isPending(approveState)
              ? intl.formatMessage({ id: 'common.loading' })
              : intl.formatMessage({ id: 'common.approve' })}
          </FlatButton>
          <BorderButton
            size="medium"
            color="error"
            disabled={!canAct || RD.isPending(approveState)}
            onClick={handleRevokeClick}>
            {intl.formatMessage({ id: 'wallet.approvals.revoke' })}
          </BorderButton>
        </div>

        {RD.isPending(approveState) && (
          <div className="mt-3">
            <Spin />
          </div>
        )}

        {RD.isFailure(approveState) && (
          <Label color="error" className="mt-2">
            {approveState.error.msg}
          </Label>
        )}

        {RD.isSuccess(approveState) && (
          <div className={clsx('mt-3')}>
            <ViewTxButton
              txHash={oTxHash}
              txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
              onClick={openExplorerTxUrl}
              network={network}
            />
          </div>
        )}
      </div>

      {/* Confirmation modals — same wallet-mode split as swap Approve */}
      {showPasswordModal && isKeystoreWallet(selectedWalletType) && (
        <WalletPasswordConfirmationModal
          onSuccess={onConfirmSuccess}
          onClose={closeConfirmModals}
          validatePassword$={validatePassword$}
        />
      )}

      <LedgerConfirmationModal
        network={network}
        onSuccess={onConfirmSuccess}
        onClose={closeConfirmModals}
        visible={showLedgerModal && isLedgerWallet(selectedWalletType)}
        chain={chain}
        description1={`${intl.formatMessage({ id: 'ledger.needsconnected' }, { chain: chainToString(chain) })} ${intl.formatMessage(
          { id: 'ledger.blindsign' },
          { chain: chainToString(chain) }
        )}`}
        description2={intl.formatMessage({ id: 'ledger.sign' })}
        addresses={FP.pipe(
          walletMeta,
          O.chain((meta) =>
            FP.pipe(
              O.fromNullable(selectedToken),
              O.map((token) => ({ sender: meta.fromAddress, recipient: token.contractAddress }))
            )
          )
        )}
      />

      {(showVultisigModal || isVultisigWallet(selectedWalletType)) && (
        <VultisigConfirmationModal
          visible={showVultisigModal && isVultisigWallet(selectedWalletType)}
          network={network}
          chain={chain}
          vaultType={vaultType}
          isEncrypted={isVaultEncrypted}
          onSuccess={onConfirmSuccess}
          onClose={closeConfirmModals}
          validatePassword$={validatePasswordAsync}
          txState={approveState}
          getActiveVaultId={getActiveVaultId}
        />
      )}
    </div>
  )
}
