import { ComponentProps, useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { useNodeListing, useOperatorFinderFeeVault } from '../../../hooks/useRunebondListing'
import { FeeRD, SendTxStateHandler } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { NodeInfo } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondWalletInfo } from '../../../views/bonds/types'
import { canTopUpVault, isVaultDepleted } from './helpers'
import { RunebondListingCard } from './RunebondListingCard'
import {
  RunebondListingAction,
  RunebondListingModal,
  RunebondListingSettled,
  useRunebondListingReload
} from './RunebondListingModal'
import { RunebondVaultSettled, RunebondVaultTopUpModal, useRunebondVaultTopUp } from './RunebondVaultTopUpModal'

export type RunebondNodeModal =
  { kind: 'listing'; action: RunebondListingAction } | { kind: 'vaultTopUp' } | { kind: 'onBehalfTopUp' }

type Params = {
  nodeAddress: Address | undefined
  isOperatorView: boolean
  oNode: O.Option<NodeInfo>
  walletInfos: BondWalletInfo[]
  balanceByAddress: (address: Address) => BaseAmount
  network: Network
  isPrivate: boolean
  fee: FeeRD
  transfer$: SendTxStateHandler
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  setModal: (modal: RunebondNodeModal | null) => void
}

export type RunebondNodeState = {
  oOwnOperatorWallet: O.Option<BondWalletInfo>
  listingCard: Omit<ComponentProps<typeof RunebondListingCard>, 'operatorAddress' | 'canOperate' | 'className'>
  renderListingModal: (node: NodeInfo, signer: BondWalletInfo, action: RunebondListingAction) => JSX.Element
  renderVaultTopUpModal: () => JSX.Element | null
  renderOnBehalfTopUpModal: (operatorAddress: Address) => JSX.Element | null
}

export const useRunebondNodeState = ({
  nodeAddress,
  isOperatorView,
  oNode,
  walletInfos,
  balanceByAddress,
  network,
  isPrivate,
  fee,
  transfer$,
  validatePassword$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  setModal
}: Params): RunebondNodeState => {
  const nodeListingRD = useNodeListing(isOperatorView ? nodeAddress : undefined)
  const {
    awaiting: listingAwaiting,
    finish: reloadListingUntil,
    listing: currentListing
  } = useRunebondListingReload(nodeListingRD)

  const vaultOperatorAddress = useMemo(
    () =>
      FP.pipe(
        oNode,
        O.filter(() => isOperatorView),
        O.map(({ nodeOperatorAddress }) => nodeOperatorAddress),
        O.toUndefined
      ),
    [isOperatorView, oNode]
  )
  const vaultRD = useOperatorFinderFeeVault(vaultOperatorAddress)
  const { vault, received: vaultTopUpReceived, finish: reloadVaultUntil } = useRunebondVaultTopUp(vaultRD)

  const oOwnOperatorWallet: O.Option<BondWalletInfo> = useMemo(
    () =>
      FP.pipe(
        oNode,
        O.chain((node) =>
          O.fromNullable(
            walletInfos.find(({ address }) => address.toLowerCase() === node.nodeOperatorAddress.toLowerCase())
          )
        )
      ),
    [oNode, walletInfos]
  )

  const oOnBehalfSigner: O.Option<BondWalletInfo> = useMemo(
    () =>
      O.fromNullable(
        walletInfos
          .filter(({ address }) => balanceByAddress(address).gt(0))
          .reduce<BondWalletInfo | undefined>(
            (best, info) =>
              best === undefined || balanceByAddress(info.address).gt(balanceByAddress(best.address)) ? info : best,
            undefined
          )
      ),
    [balanceByAddress, walletInfos]
  )

  const closeModal = useCallback(() => setModal(null), [setModal])
  const finishListingAction = useCallback(
    (settled: RunebondListingSettled) => {
      closeModal()
      reloadListingUntil(settled)
    },
    [closeModal, reloadListingUntil]
  )
  const vaultTopUpAvailable = canTopUpVault(vault)
  const openVaultTopUp = useCallback(() => {
    if (!vaultTopUpAvailable) return
    setModal({ kind: 'vaultTopUp' })
  }, [setModal, vaultTopUpAvailable])
  const finishVaultTopUp = useCallback(
    (settled: RunebondVaultSettled) => {
      closeModal()
      reloadVaultUntil(settled)
    },
    [closeModal, reloadVaultUntil]
  )
  const openOnBehalfTopUp =
    O.isSome(oOnBehalfSigner) && isVaultDepleted(vault) ? () => setModal({ kind: 'onBehalfTopUp' }) : undefined

  const renderVaultTopUp = (signer: BondWalletInfo, operatorAddress: Address, onBehalf: boolean) => (
    <RunebondVaultTopUpModal
      network={network}
      operatorAddress={operatorAddress}
      vault={vault}
      signer={signer}
      walletBalance={balanceByAddress(signer.address)}
      fee={fee}
      transfer$={transfer$}
      validatePassword$={validatePassword$}
      openExplorerTxUrl={openExplorerTxUrl}
      getExplorerTxUrl={getExplorerTxUrl}
      onBehalf={onBehalf}
      onClose={closeModal}
      onFinish={finishVaultTopUp}
    />
  )

  return {
    oOwnOperatorWallet,
    listingCard: {
      network,
      isPrivate,
      listingRD: nodeListingRD,
      awaiting: listingAwaiting,
      refreshing: RD.isPending(nodeListingRD) || RD.isPending(vaultRD),
      vault,
      vaultTopUpReceived,
      onList: () => setModal({ kind: 'listing', action: { type: 'list' } }),
      onDelist: () => setModal({ kind: 'listing', action: { type: 'delist' } }),
      onTopUp: openVaultTopUp,
      onTopUpOnBehalf: openOnBehalfTopUp
    },
    renderListingModal: (node, signer, action) => (
      <RunebondListingModal
        action={action}
        network={network}
        node={node}
        signer={signer}
        listing={currentListing}
        walletBalance={balanceByAddress(signer.address)}
        fee={fee}
        transfer$={transfer$}
        validatePassword$={validatePassword$}
        openExplorerTxUrl={openExplorerTxUrl}
        getExplorerTxUrl={getExplorerTxUrl}
        vault={vault}
        onTopUpVault={openVaultTopUp}
        onClose={closeModal}
        onFinish={finishListingAction}
      />
    ),
    renderVaultTopUpModal: () =>
      FP.pipe(
        oOwnOperatorWallet,
        O.fold(
          () => null,
          (signer) => renderVaultTopUp(signer, signer.address, false)
        )
      ),
    renderOnBehalfTopUpModal: (operatorAddress) =>
      FP.pipe(
        oOnBehalfSigner,
        O.fold(
          () => null,
          (signer) => renderVaultTopUp(signer, operatorAddress, true)
        )
      )
  }
}
