/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, UseMutationOptions } from '@tanstack/react-query'
import { useVultisig } from '../../../../../store/vultisig/hooks'
import { getPublicKey } from '../../../chain/publicKey/getPublicKey'
import { deriveAddress } from '../../../chain/utils/deriveAddress'
import { useAssertWalletCore } from '../../chain/providers/WalletCoreProvider'
import { initialDefaultChains } from '../../storage/defaultChain'

import { Vault } from '../Vault'

export const useCreateVaultMutation = (options?: UseMutationOptions<any, any, Vault, unknown>) => {
  const walletCore = useAssertWalletCore()
  const { setVault } = useVultisig()

  return useMutation({
    mutationFn: async (input: Vault) => {
      const vault = input

      const defaultChains = initialDefaultChains
      const coins = await Promise.all(
        defaultChains.map(async (chain) => {
          const publicKey = getPublicKey({
            chain,
            walletCore,
            hexChainCode: vault.hexChainCode,
            publicKeys: vault.publicKeys
          })

          const address = deriveAddress({
            chain,
            publicKey,
            walletCore
          })

          return {
            chain,
            address
          }
        })
      )
      console.log('CREATE VAULT FLOW - ', vault.name)

      setVault({ ...vault, coins })
      return { ...vault, coins }
    },
    ...options
  })
}
