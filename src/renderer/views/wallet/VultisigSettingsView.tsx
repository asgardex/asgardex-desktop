import { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isSupportedChain } from '../../../shared/utils/chain'
import { WalletType } from '../../../shared/wallet/types'
import { WalletSettings } from '../../components/settings'
import { useChainContext } from '../../contexts/ChainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import { useNetwork } from '../../hooks/useNetwork'
import { VultisigState, ValidatePasswordHandler } from '../../services/wallet/types'

type Props = {
  vultisigState: VultisigState
}

export const VultisigSettingsView = ({ vultisigState }: Props): JSX.Element => {
  const { appWalletService } = useWalletContext()
  const vaultManager = appWalletService.vaultManager
  const { network } = useNetwork()
  const { walletsUI } = useKeystoreWallets()
  const { clientByChain$ } = useChainContext()

  const lockWallet = useCallback(() => {
    appWalletService.lock()
  }, [appWalletService])

  // Wrap vaultManager.validatePassword as ValidatePasswordHandler (returns LiveData<Error, void>)
  const validatePassword$: ValidatePasswordHandler = useCallback(
    (password: string) =>
      FP.pipe(
        Rx.from(vaultManager.validatePassword(password)),
        RxOp.map((valid) => {
          if (!valid) throw new Error('Invalid password')
          return RD.success(undefined as void)
        }),
        RxOp.catchError((err) => Rx.of(RD.failure(err instanceof Error ? err : new Error(String(err)))))
      ),
    [vaultManager]
  )

  // Open explorer for address - take(1) auto-completes, timeout prevents hanging if client never emits
  const clickAddressLinkHandler = useCallback(
    (chain: Chain, address: Address) => {
      if (!isSupportedChain(chain)) return
      clientByChain$(chain)
        .pipe(RxOp.take(1), RxOp.timeout(5000))
        .subscribe({
          next: (oClient) => {
            FP.pipe(
              oClient,
              O.map((client) => {
                window.apiUrl.openExternal(client.getExplorerAddressUrl(address))
              })
            )
          },
          error: () => {
            // Timeout or error - silently ignore (chain client not available)
          }
        })
    },
    [clientByChain$]
  )

  const removeVault = useCallback((vaultId: string) => vaultManager.deleteVault(vaultId), [vaultManager])

  const renameVault = useCallback(
    (vaultId: string, newName: string) => vaultManager.renameVault(vaultId, newName),
    [vaultManager]
  )

  const exportVault = useCallback((vaultId: string) => vaultManager.exportVault(vaultId), [vaultManager])

  const changeVault = useCallback((vaultId: string) => vaultManager.selectVault(vaultId), [vaultManager])

  return (
    <WalletSettings
      walletMode={WalletType.Vultisig}
      network={network}
      wallets={walletsUI}
      lockWallet={lockWallet}
      clickAddressLinkHandler={clickAddressLinkHandler}
      validatePassword$={validatePassword$}
      vultisigState={vultisigState}
      vultisigVaults={vultisigState.availableVaults}
      activeVaultId={vultisigState.activeVault?.id ?? null}
      removeVault={removeVault}
      renameVault={renameVault}
      exportVault={exportVault}
      changeVault={changeVault}
    />
  )
}
