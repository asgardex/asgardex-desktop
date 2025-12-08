import React, { useCallback, useMemo, useState, useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  Chain,
  baseToAsset,
  formatAssetAmountCurrency,
  assetAmount,
  assetToBase,
  TokenAsset,
  isTokenAsset
} from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'

import { isLedgerWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { useEvmContext } from '../../../contexts/EvmContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { getEVMTokenAddressForChain } from '../../../helpers/assetHelper'
import { isEvmChainToken } from '../../../helpers/evmHelper'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { tradeDeposit$, generateTradeMemo } from '../../../services/chain/transaction/tradeDeposit'
import { DepositState$ } from '../../../services/chain/types'
import { ApproveParams, IsApproveParams } from '../../../services/evm/types'
import {
  ChainBalance,
  WalletBalance,
  ValidatePasswordHandler,
  TxHashRD,
  ApiError
} from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { AssetSelect } from '../../uielements/assets/assetSelect'
import { Button, BaseButton } from '../../uielements/button'
import { Label } from '../../uielements/label'
import { Modal } from '../../uielements/modal'
import { ProtocolSwitch } from '../../uielements/protocolSwitch'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../confirmation'
import { TxModal } from '../tx'

// Modal states for transaction flow
enum ModalState {
  Deposit = 'deposit',
  Approve = 'approve',
  None = 'none'
}

type TradeDepositModalProps = {
  visible: boolean
  chainBalances: ChainBalance[]
  initialProtocol?: Chain
  thorProtocolAddress?: string
  mayaProtocolAddress?: string
  network: Network
  validatePassword$: ValidatePasswordHandler
  onClose: () => void
}

export const TradeDepositModal = (props: TradeDepositModalProps): JSX.Element => {
  const {
    visible,
    chainBalances,
    initialProtocol = THORChain,
    thorProtocolAddress,
    mayaProtocolAddress,
    network,
    validatePassword$,
    onClose
  } = props
  const intl = useIntl()

  // Get selected pool addresses from Midgard contexts
  const {
    service: {
      pools: { selectedPoolAddress$: selectedPoolAddressThor$ }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { selectedPoolAddress$: selectedPoolAddressMaya$ }
    }
  } = useMidgardMayaContext()

  const selectedPoolAddressThor = useObservableState(selectedPoolAddressThor$, O.none)
  const selectedPoolAddressMaya = useObservableState(selectedPoolAddressMaya$, O.none)

  const [selectedAsset, setSelectedAsset] = useState<O.Option<AnyAsset>>(O.none)
  const [amount, setAmount] = useState('')
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType>(WalletType.Keystore)
  const [selectedProtocol, setSelectedProtocol] = useState<string>(initialProtocol)

  // Modal states for transaction flow
  const [showPasswordModal, setShowPasswordModal] = useState(ModalState.None)
  const [showLedgerModal, setShowLedgerModal] = useState(ModalState.None)

  // Transaction state
  const [depositState$, setDepositState$] = useState<DepositState$ | null>(null)
  const depositState = useObservableState(depositState$ || Rx.of(null), null)

  // ERC20 Approval state management
  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

  const {
    state: isApprovedState,
    reset: resetIsApprovedState,
    subscribe: subscribeIsApprovedState
  } = useSubscriptionState<RD.RemoteData<ApiError, boolean>>(RD.initial)

  // Get the current protocol address
  const protocolAddress = selectedProtocol === THORChain ? thorProtocolAddress : mayaProtocolAddress
  const currentProtocol = selectedProtocol as Chain

  // Check if user is using ledger wallet
  const isLedgerWalletSelected = isLedgerWallet(selectedWalletType)
  // Filter assets that have balances and are supported by the current protocol
  const availableAssets = useMemo(() => {
    return FP.pipe(
      chainBalances,
      A.chain((chainBalance) =>
        FP.pipe(
          chainBalance.balances,
          RD.getOrElse((): WalletBalance[] => []),
          A.filter(
            (balance) =>
              balance.amount.gt(0) &&
              balance.asset.chain !== currentProtocol && // Don't allow depositing the protocol's own asset
              !(balance.asset.chain === AssetCacao.chain && balance.asset.symbol === AssetCacao.symbol) // Don't allow depositing CACAO
          ),
          A.map((balance) => ({
            asset: balance.asset,
            amount: balance.amount,
            walletType: chainBalance.walletType,
            walletAddress: balance.walletAddress,
            walletAccount: balance.walletAccount,
            walletIndex: balance.walletIndex
          }))
        )
      )
    )
  }, [chainBalances, currentProtocol])

  // Get the current selected asset's balance
  const selectedAssetBalance = useMemo(() => {
    return FP.pipe(
      selectedAsset,
      O.fold(
        () => O.none,
        (asset) => {
          // First try to find exact match with selected wallet type
          const exactMatch = FP.pipe(
            availableAssets,
            A.findFirst(
              (item) =>
                item.asset.chain === asset.chain &&
                item.asset.symbol === asset.symbol &&
                item.walletType === selectedWalletType
            )
          )

          // If no exact match, find any balance for the selected asset
          if (O.isNone(exactMatch)) {
            return FP.pipe(
              availableAssets,
              A.findFirst((item) => item.asset.chain === asset.chain && item.asset.symbol === asset.symbol)
            )
          }

          return exactMatch
        }
      )
    )
  }, [selectedAsset, selectedWalletType, availableAssets])

  // Get ERC20 services dynamically based on selected asset chain
  const selectedAssetChain = FP.pipe(
    selectedAsset,
    O.fold(
      () => 'ETH', // default to ETH if no asset selected
      (asset) => asset.chain
    )
  )
  const { approveERC20Token$, isApprovedERC20Token$ } = useEvmContext(selectedAssetChain)

  // ERC20 approval logic
  const needApprovement: O.Option<boolean> = useMemo(() => {
    return FP.pipe(
      selectedAsset,
      O.fold(
        () => O.none,
        (asset) => (isEvmChainToken(asset) ? O.some(isTokenAsset(asset)) : O.none)
      )
    )
  }, [selectedAsset])

  // Generate approval parameters when needed
  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    return FP.pipe(
      selectedAsset,
      O.chain((asset) => {
        if (!isEvmChainToken(asset) || !isTokenAsset(asset)) return O.none

        const poolAddress = currentProtocol === THORChain ? selectedPoolAddressThor : selectedPoolAddressMaya

        return FP.pipe(
          poolAddress,
          O.chain((poolAddr) =>
            FP.pipe(
              poolAddr.router,
              O.chain((routerAddress) =>
                FP.pipe(
                  selectedAssetBalance,
                  O.chain((balance) => {
                    const tokenAddress = getEVMTokenAddressForChain(asset.chain, asset as TokenAsset)
                    return FP.pipe(
                      tokenAddress,
                      O.map((contractAddress) => ({
                        contractAddress,
                        spenderAddress: routerAddress,
                        fromAddress: balance.walletAddress,
                        walletAccount: balance.walletAccount,
                        walletIndex: balance.walletIndex,
                        walletType: balance.walletType,
                        hdMode: 'default' as const,
                        network
                      }))
                    )
                  })
                )
              )
            )
          )
        )
      })
    )
  }, [selectedAsset, currentProtocol, selectedPoolAddressThor, selectedPoolAddressMaya, selectedAssetBalance, network])

  // Generate isApprove parameters for checking approval status
  const oIsApproveParams: O.Option<IsApproveParams> = useMemo(() => {
    return FP.pipe(
      oApproveParams,
      O.map((params) => ({
        contractAddress: params.contractAddress,
        spenderAddress: params.spenderAddress,
        fromAddress: params.fromAddress
      }))
    )
  }, [oApproveParams])

  // Get unique assets (combine from different wallet types)
  const uniqueAssets = useMemo(() => {
    const assetMap = new Map<string, AnyAsset>()
    availableAssets.forEach(({ asset }) => {
      const key = `${asset.chain}.${asset.symbol}`
      if (!assetMap.has(key)) {
        assetMap.set(key, asset)
      }
    })
    const result = Array.from(assetMap.values())
    return result
  }, [availableAssets])

  // Get available wallet types for selected asset
  const availableWalletTypes = useMemo(() => {
    return FP.pipe(
      selectedAsset,
      O.fold(
        () => [],
        (asset) =>
          FP.pipe(
            availableAssets,
            A.filter((item) => item.asset.chain === asset.chain && item.asset.symbol === asset.symbol),
            A.map((item) => item.walletType)
          )
      )
    )
  }, [selectedAsset, availableAssets])

  const handleAssetSelect = useCallback(
    (asset: AnyAsset) => {
      setSelectedAsset(O.some(asset))
      setAmount('')

      // Find the first available balance for this asset and set the wallet type accordingly
      const assetBalance = FP.pipe(
        availableAssets,
        A.findFirst((item) => item.asset.chain === asset.chain && item.asset.symbol === asset.symbol)
      )

      FP.pipe(
        assetBalance,
        O.fold(
          () => {
            // Fallback to Keystore if no balance found
            setSelectedWalletType(WalletType.Keystore)
          },
          (balance) => {
            setSelectedWalletType(balance.walletType)
          }
        )
      )
    },
    [availableAssets]
  )

  const handleAmountChange = useCallback((value: string) => {
    setAmount(value)
  }, [])

  const handleWalletTypeSelect = useCallback((walletType: WalletType) => {
    setSelectedWalletType(walletType)
    setAmount('') // Reset amount when wallet type changes
  }, [])

  const handleMaxClick = useCallback(() => {
    FP.pipe(
      selectedAssetBalance,
      O.fold(
        () => {
          // No balance available, do nothing
        },
        (balance) => {
          FP.pipe(
            selectedAsset,
            O.fold(
              () => {
                // No asset selected
              },
              (asset) => {
                const formattedAmount = formatAssetAmountCurrency({
                  amount: baseToAsset(balance.amount),
                  asset,
                  decimal: 8,
                  trimZeros: true
                }).replace(/[^0-9.]/g, '') // Remove currency symbols and keep only numbers and decimal
                setAmount(formattedAmount)
              }
            )
          )
        }
      )
    )
  }, [selectedAssetBalance, selectedAsset])

  // Check approval status
  const checkApprovedStatus = useCallback(
    (params: IsApproveParams) => {
      subscribeIsApprovedState(isApprovedERC20Token$(params))
    },
    [isApprovedERC20Token$, subscribeIsApprovedState]
  )

  // Submit approval transaction
  const submitApproveTx = useCallback(() => {
    FP.pipe(
      oApproveParams,
      O.map((params) => subscribeApproveState(approveERC20Token$(params)))
    )
  }, [oApproveParams, subscribeApproveState, approveERC20Token$])

  // Determine if approval is needed (approved or not an ERC20 token)
  const isApproved = useMemo(() => {
    // No approval needed if not an ERC20 token
    if (O.isNone(needApprovement)) return true
    // Check if approved
    return RD.isSuccess(approveState) || RD.isSuccess(isApprovedState)
  }, [needApprovement, approveState, isApprovedState])

  const isValidAmount = useMemo(() => {
    if (!amount) return false

    return FP.pipe(
      selectedAssetBalance,
      O.fold(
        () => false,
        (balance) => {
          try {
            return balance.amount.gt(0)
          } catch (error) {
            return false
          }
        }
      )
    )
  }, [amount, selectedAssetBalance])

  const handleProtocolChange = useCallback((newProtocol: string) => {
    setSelectedProtocol(newProtocol)
    // Reset form when protocol changes
    setSelectedAsset(O.none)
    setAmount('')
    setSelectedWalletType(WalletType.Keystore)
  }, [])

  // Check approval status when approval params change
  useEffect(() => {
    if (O.isSome(oIsApproveParams)) {
      resetIsApprovedState()
      FP.pipe(oIsApproveParams, O.map(checkApprovedStatus))
    }
  }, [oIsApproveParams, checkApprovedStatus, resetIsApprovedState])

  // Handle initial confirm click - triggers approval or deposit flow
  const handleConfirm = useCallback(() => {
    if (O.isSome(selectedAsset) && isValidAmount) {
      // Check if approval is needed for ERC20 tokens
      if (O.isSome(needApprovement) && !isApproved) {
        // Need to approve first - trigger approval modal
        if (isLedgerWalletSelected) {
          setShowLedgerModal(ModalState.Approve)
        } else {
          setShowPasswordModal(ModalState.Approve)
        }
      } else {
        // Can proceed directly to deposit - trigger deposit modal
        if (isLedgerWalletSelected) {
          setShowLedgerModal(ModalState.Deposit)
        } else {
          setShowPasswordModal(ModalState.Deposit)
        }
      }
    }
  }, [selectedAsset, isValidAmount, needApprovement, isApproved, isLedgerWalletSelected])

  // Submit the actual transaction after password/ledger confirmation
  const submitTransaction = useCallback(() => {
    if (O.isNone(selectedAsset) || !protocolAddress) return

    // TypeScript needs to know protocolAddress is defined here
    const currentProtocolAddress = protocolAddress

    // Get the correct pool address based on selected protocol
    const poolAddress = currentProtocol === THORChain ? selectedPoolAddressThor : selectedPoolAddressMaya

    if (O.isNone(poolAddress)) {
      console.error('Pool address not available')
      return
    }

    FP.pipe(
      selectedAssetBalance,
      O.fold(
        () => console.error('No balance found'),
        (balance) => {
          FP.pipe(
            selectedAsset,
            O.fold(
              () => console.error('No asset selected'),
              (asset) => {
                // Convert amount to BaseAmount
                const userAmount = parseFloat(amount)
                const amountToDeposit = assetToBase(assetAmount(userAmount, balance.amount.decimal))

                // Generate the trade memo
                const memo = generateTradeMemo(currentProtocolAddress)

                // Start the transaction
                const txStream$ = tradeDeposit$({
                  poolAddress: poolAddress.value,
                  asset,
                  amount: amountToDeposit,
                  memo,
                  sender: balance.walletAddress,
                  walletType: selectedWalletType,
                  walletAccount: balance.walletAccount,
                  walletIndex: balance.walletIndex,
                  hdMode: 'default',
                  protocol: currentProtocol
                })

                setDepositState$(txStream$)
              }
            )
          )
        }
      )
    )
  }, [
    selectedAsset,
    protocolAddress,
    currentProtocol,
    selectedPoolAddressThor,
    selectedPoolAddressMaya,
    selectedAssetBalance,
    amount,
    selectedWalletType
  ])

  const handleCancel = useCallback(() => {
    setSelectedAsset(O.none)
    setAmount('')
    setSelectedWalletType(WalletType.Keystore)
    onClose()
  }, [onClose])

  const canProceed = O.isSome(selectedAsset) && isValidAmount

  // Get appropriate button text based on approval state
  const getButtonText = useMemo(() => {
    if (O.isSome(needApprovement) && !isApproved) {
      return intl.formatMessage({ id: 'common.approve' })
    }
    return intl.formatMessage({ id: 'common.confirm' })
  }, [needApprovement, isApproved, intl])

  // Render password confirmation modal
  const renderPasswordConfirmationModal = useMemo(() => {
    const onSuccess = () => {
      if (showPasswordModal === ModalState.Approve) {
        submitApproveTx()
      } else if (showPasswordModal === ModalState.Deposit) {
        submitTransaction()
      }
      setShowPasswordModal(ModalState.None)
    }

    const onClose = () => {
      setShowPasswordModal(ModalState.None)
    }

    const render = showPasswordModal === ModalState.Approve || showPasswordModal === ModalState.Deposit

    return (
      render && (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccess}
          onClose={onClose}
          validatePassword$={validatePassword$}
        />
      )
    )
  }, [showPasswordModal, submitApproveTx, submitTransaction, validatePassword$])

  // Render ledger confirmation modal
  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === ModalState.Approve || showLedgerModal === ModalState.Deposit

    const onClose = () => {
      setShowLedgerModal(ModalState.None)
    }

    const onSuccess = () => {
      if (showLedgerModal === ModalState.Approve) {
        submitApproveTx()
      } else if (showLedgerModal === ModalState.Deposit) {
        submitTransaction()
      }
      setShowLedgerModal(ModalState.None)
    }

    const description = intl.formatMessage({ id: 'ledger.sign' })

    return (
      visible && (
        <LedgerConfirmationModal
          key="ledger-conf-modal"
          network={network}
          onSuccess={onSuccess}
          onClose={onClose}
          visible={visible}
          chain={FP.pipe(
            selectedAsset,
            O.fold(
              () => 'ETH', // fallback to ETH when no asset selected
              (asset) => asset.chain
            )
          )}
          description1={description}
          description2={intl.formatMessage({ id: 'ledger.sign' })}
          addresses={O.none} // Will be handled by the transaction service
        />
      )
    )
  }, [showLedgerModal, network, selectedAsset, intl, submitApproveTx, submitTransaction])

  // Render approval transaction progress modal
  const renderApproveTxModal = useMemo(() => {
    if (RD.isPending(approveState) || RD.isSuccess(approveState) || RD.isFailure(approveState)) {
      return (
        <TxModal
          title={intl.formatMessage({ id: 'common.approve' })}
          onClose={() => {
            resetApproveState()
            if (RD.isSuccess(approveState)) {
              // After successful approval, trigger deposit
              if (isLedgerWalletSelected) {
                setShowLedgerModal(ModalState.Deposit)
              } else {
                setShowPasswordModal(ModalState.Deposit)
              }
            }
          }}
          onFinish={() => {
            resetApproveState()
            // After successful approval, trigger deposit
            if (RD.isSuccess(approveState)) {
              if (isLedgerWalletSelected) {
                setShowLedgerModal(ModalState.Deposit)
              } else {
                setShowPasswordModal(ModalState.Deposit)
              }
            }
          }}
          startTime={Date.now()}
          txRD={RD.map(() => true)(approveState)}
          extraResult={
            <div className="flex flex-col gap-2">
              <Label size="normal" color="primary">
                ERC20 Approval
              </Label>
              {FP.pipe(
                selectedAsset,
                O.fold(
                  () => null,
                  (asset) => (
                    <Label size="small" color="gray">
                      Approve {asset.symbol} for trading
                    </Label>
                  )
                )
              )}
            </div>
          }
        />
      )
    }
    return null
  }, [approveState, intl, resetApproveState, selectedAsset, isLedgerWalletSelected])

  // Render transaction progress modal
  const renderTxModal = useMemo(() => {
    if (!depositState) return null

    return (
      <TxModal
        title={intl.formatMessage({ id: 'common.tx.broadcasting' })}
        onClose={() => {
          setDepositState$(null)
          onClose()
        }}
        onFinish={() => {
          setDepositState$(null)
          onClose()
        }}
        startTime={Date.now()}
        txRD={depositState.deposit}
        extraResult={
          <div className="flex flex-col gap-2">
            <Label size="normal" color="primary">
              Trade Deposit Transaction
            </Label>
            {FP.pipe(
              selectedAsset,
              O.fold(
                () => null,
                (asset) => (
                  <Label size="small" color="gray">
                    {amount} {asset.symbol} → {currentProtocol === THORChain ? 'THORChain' : 'MAYAChain'}
                  </Label>
                )
              )
            )}
          </div>
        }
      />
    )
  }, [depositState, intl, onClose, selectedAsset, amount, currentProtocol])

  return (
    <>
      {renderPasswordConfirmationModal}
      {renderLedgerConfirmationModal}
      {renderApproveTxModal}
      {renderTxModal}
      <Modal
        visible={
          visible && showPasswordModal === ModalState.None && showLedgerModal === ModalState.None && !depositState
        }
        title={intl.formatMessage({ id: 'wallet.action.deposit' })}
        onCancel={handleCancel}
        panelClassName="!max-w-[480px]">
        <div className="flex flex-col gap-6 p-6">
          {/* Protocol Selection */}
          <div className="flex flex-col gap-2">
            <Label size="normal" color="primary">
              {intl.formatMessage({ id: 'wallet.action.deposit' })} Protocol
            </Label>
            <div className="rounded-lg border border-gray0 bg-gray0 p-3 dark:border-gray0d dark:bg-gray0d">
              <ProtocolSwitch protocol={selectedProtocol} setProtocol={handleProtocolChange} />
            </div>
            <Label size="small" color="gray">
              Choose where your trade assets will be deposited:{' '}
              {currentProtocol === THORChain ? 'THORChain' : 'MAYAChain'}
            </Label>
          </div>

          {/* Asset Selection */}
          <div className="flex flex-col gap-2">
            <Label size="normal" color="primary">
              {intl.formatMessage({ id: 'common.asset' })}
            </Label>
            <AssetSelect
              asset={FP.pipe(
                selectedAsset,
                O.getOrElse(() => AssetBTC as AnyAsset)
              )}
              assets={uniqueAssets}
              onSelect={handleAssetSelect}
              network={network}
              dialogHeadline={intl.formatMessage({ id: 'common.asset.chooseAsset' })}
              className="w-full"
              shadowless
            />
          </div>

          {/* Wallet Type Selection */}
          {O.isSome(selectedAsset) && availableWalletTypes.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label size="normal" color="primary">
                {intl.formatMessage({ id: 'wallet.type' })}
              </Label>
              <div className="flex gap-2">
                {availableWalletTypes.map((walletType) => (
                  <Button
                    key={walletType}
                    onClick={() => handleWalletTypeSelect(walletType)}
                    className={`flex-1 ${
                      selectedWalletType === walletType
                        ? 'bg-turquoise text-white'
                        : 'bg-gray0 text-gray2 dark:bg-gray0d dark:text-gray2d'
                    }`}>
                    {walletTypeToI18n(walletType, intl)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Balance Display */}
          {FP.pipe(
            selectedAssetBalance,
            O.fold(
              () => null,
              (balance) => (
                <div className="flex items-center justify-between rounded-lg bg-gray0 p-3 dark:bg-gray0d">
                  <Label size="normal" color="gray">
                    {intl.formatMessage({ id: 'common.balance' })}
                  </Label>
                  <Label size="normal" color="primary">
                    {balance.amount.amount().toString()}{' '}
                    {FP.pipe(
                      selectedAsset,
                      O.fold(
                        () => '',
                        (asset) => asset.symbol
                      )
                    )}
                  </Label>
                </div>
              )
            )
          )}

          {/* Amount Input */}
          {O.isSome(selectedAsset) &&
            FP.pipe(
              selectedAssetBalance,
              O.fold(
                () => null,
                (balance) => (
                  <div className="flex flex-col gap-2">
                    <Label size="normal" color="primary">
                      {intl.formatMessage({ id: 'common.amount' })}
                    </Label>
                    <div className="relative flex">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray1 bg-white p-3 pr-16 text-text2 dark:border-gray1d dark:bg-bg1d dark:text-text2d"
                      />
                      <Button
                        onClick={handleMaxClick}
                        disabled={O.isNone(selectedAsset) || O.isNone(selectedAssetBalance)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-turquoise px-3 py-1 text-xs text-white hover:bg-turquoise/80 disabled:cursor-not-allowed disabled:bg-gray1 disabled:text-gray2 dark:disabled:bg-gray1d dark:disabled:text-gray2d">
                        {intl.formatMessage({ id: 'common.max' })}
                      </Button>
                    </div>
                    <Label size="small" color="gray">
                      Max:{' '}
                      {formatAssetAmountCurrency({
                        amount: baseToAsset(balance.amount),
                        asset: FP.pipe(
                          selectedAsset,
                          O.getOrElse(() => AssetBTC as AnyAsset)
                        ),
                        decimal: 8,
                        trimZeros: true
                      })}
                    </Label>
                  </div>
                )
              )
            )}

          {/* Memo */}
          {O.isSome(selectedAsset) && (
            <div className="flex flex-col gap-2">
              <Label size="normal" color="primary">
                {intl.formatMessage({ id: 'common.memo' })}
              </Label>
              <div className="rounded-lg bg-gray0 p-3 dark:bg-gray0d">
                <Label size="small" color="primary">
                  TRADE+:{protocolAddress || `{YOUR_${currentProtocol === THORChain ? 'THOR' : 'MAYA'}_ADDRESS}`}
                </Label>
              </div>
              {!protocolAddress && (
                <Label size="small" color="gray">
                  {intl.formatMessage({ id: 'common.memo' })} will be auto-generated with your{' '}
                  {currentProtocol === THORChain ? 'THORChain' : 'MAYAChain'} address
                </Label>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4">
            <BaseButton
              onClick={handleCancel}
              className="flex-1 bg-gray1 text-gray2 hover:bg-gray2 dark:bg-gray1d dark:text-gray2d dark:hover:bg-gray2d">
              {intl.formatMessage({ id: 'common.cancel' })}
            </BaseButton>
            <BaseButton
              onClick={handleConfirm}
              disabled={!canProceed}
              className={`flex-1 ${
                canProceed
                  ? 'bg-turquoise text-white hover:bg-turquoise/80'
                  : 'cursor-not-allowed bg-gray1 text-gray2 dark:bg-gray1d dark:text-gray2d'
              }`}>
              {getButtonText}
            </BaseButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
