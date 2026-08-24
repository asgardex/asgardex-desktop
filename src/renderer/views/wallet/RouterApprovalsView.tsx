import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import {
  ApprovalProtocol,
  ApprovalWalletOption,
  approvalWalletOptionId,
  RouterApprovals
} from '../../components/wallet/approvals'
import { AssetsNav } from '../../components/wallet/assets'
import { useEvmContext } from '../../contexts/EvmContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { useNetwork } from '../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../hooks/useOpenExplorerTxUrl'
import { isVultisigMode, isVultisigVaultPasswordRequired, VaultType, WalletBalances } from '../../services/wallet/types'

export const RouterApprovalsView = (): JSX.Element => {
  const { network } = useNetwork()
  const [protocol, setProtocol] = useState<ApprovalProtocol>('Thorchain')
  const [chain, setChain] = useState<Chain>(ETHChain)
  const [selectedWalletId, setSelectedWalletId] = useState<O.Option<string>>(O.none)

  const { getERC20Allowance$, approveERC20Token$, approveFee$, reloadApproveFee } = useEvmContext(chain)
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(chain))

  const { inboundAddressesShared$: thorInbound$ } = useThorchainContext()
  const { inboundAddressesShared$: mayaInbound$ } = useMayachainContext()
  const {
    chainBalances$,
    keystoreService: { validatePassword$ },
    appWalletService
  } = useWalletContext()

  const appWalletState = useObservableState(appWalletService.appWalletState$, null)

  const vaultType: VaultType = useMemo(() => {
    if (appWalletState && isVultisigMode(appWalletState) && appWalletState.activeVault) {
      return appWalletState.activeVault.type
    }
    return 'fast'
  }, [appWalletState])

  const isVaultEncrypted = useMemo(
    () => (appWalletState ? isVultisigVaultPasswordRequired(appWalletState) : true),
    [appWalletState]
  )

  // Keep streams separate — THOR/MAYA InboundAddress types are not assignable to each other
  const thorInboundRD = useObservableState(thorInbound$, RD.pending)
  const mayaInboundRD = useObservableState(mayaInbound$, RD.pending)

  const chainBalances = useObservableState(chainBalances$, [])

  const walletOptions: ApprovalWalletOption[] = useMemo(() => {
    const options: ApprovalWalletOption[] = []
    const seen = new Set<string>()

    for (const cb of chainBalances) {
      if (cb.chain !== chain || O.isNone(cb.walletAddress)) continue

      const fromAddress = cb.walletAddress.value
      const baseMeta =
        RD.isSuccess(cb.balances) && cb.balances.value.length > 0
          ? {
              fromAddress,
              walletType: cb.balances.value[0].walletType,
              walletAccount: cb.balances.value[0].walletAccount,
              walletIndex: cb.balances.value[0].walletIndex,
              hdMode: cb.balances.value[0].hdMode
            }
          : {
              fromAddress,
              walletType: cb.walletType,
              walletAccount: 0,
              walletIndex: 0,
              hdMode: cb.hdMode
            }

      const id = approvalWalletOptionId(baseMeta)
      if (seen.has(id)) continue
      seen.add(id)
      options.push({ ...baseMeta, id })
    }

    return options
  }, [chainBalances, chain])

  // Keep selection valid when chain / options change
  useEffect(() => {
    if (walletOptions.length === 0) {
      setSelectedWalletId(O.none)
      return
    }
    setSelectedWalletId((prev) => {
      if (O.isSome(prev) && walletOptions.some((o) => o.id === prev.value)) return prev
      return O.some(walletOptions[0].id)
    })
  }, [walletOptions])

  const selectedWallet: O.Option<ApprovalWalletOption> = useMemo(
    () =>
      FP.pipe(
        selectedWalletId,
        O.chain((id) => O.fromNullable(walletOptions.find((o) => o.id === id)))
      ),
    [selectedWalletId, walletOptions]
  )

  const walletBalances: WalletBalances = useMemo(() => {
    if (O.isNone(selectedWallet)) return []
    const { fromAddress, walletType } = selectedWallet.value
    const match = chainBalances.find(
      (cb) =>
        cb.chain === chain &&
        O.isSome(cb.walletAddress) &&
        cb.walletAddress.value === fromAddress &&
        cb.walletType === walletType
    )
    if (!match || !RD.isSuccess(match.balances)) return []
    return match.balances.value
  }, [chainBalances, chain, selectedWallet])

  const oRouterAddress: O.Option<Address> = useMemo(() => {
    const findRouter = (inbounds: { chain: Chain; router?: string }[]): O.Option<Address> => {
      const row = inbounds.find((i) => i.chain === chain)
      if (!row?.router) return O.none
      return O.some(row.router)
    }

    if (protocol === 'Thorchain') {
      return RD.isSuccess(thorInboundRD) ? findRouter(thorInboundRD.value) : O.none
    }
    return RD.isSuccess(mayaInboundRD) ? findRouter(mayaInboundRD.value) : O.none
  }, [protocol, thorInboundRD, mayaInboundRD, chain])

  return (
    <div className="flex w-full flex-col">
      <AssetsNav />
      <div className="rounded-b-lg bg-bg0 p-4 dark:bg-bg0d">
        <RouterApprovals
          network={network}
          protocol={protocol}
          setProtocol={setProtocol}
          chain={chain}
          setChain={setChain}
          walletOptions={walletOptions}
          selectedWallet={selectedWallet}
          setSelectedWalletId={(id) => setSelectedWalletId(O.some(id))}
          walletBalances={walletBalances}
          oRouterAddress={oRouterAddress}
          getERC20Allowance$={getERC20Allowance$}
          approveERC20Token$={approveERC20Token$}
          approveFee$={approveFee$}
          reloadApproveFee={reloadApproveFee}
          openExplorerTxUrl={openExplorerTxUrl}
          getExplorerTxUrl={getExplorerTxUrl}
          validatePassword$={validatePassword$}
          vaultType={vaultType}
          isVaultEncrypted={isVaultEncrypted}
          getActiveVaultId={appWalletService.getActiveVaultId}
        />
      </div>
    </div>
  )
}
