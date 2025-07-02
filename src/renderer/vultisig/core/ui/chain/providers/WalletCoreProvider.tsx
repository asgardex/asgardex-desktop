import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { initWasm, WalletCore } from '@trustwallet/wallet-core'
import { Label } from '../../../../../components/uielements/label'
import { ChildrenProp } from '../../../../lib/ui/props'
import { fixedDataQueryOptions } from '../../../../lib/ui/query/utils/options'
import { shouldBePresent } from '../../../../lib/utils/assert/shouldBePresent'

const WalletCoreContext = createContext<WalletCore | null>(null)

export const WalletCoreProvider = ({ children }: ChildrenProp) => {
  const query = useQuery({
    queryKey: ['walletCore'],
    ...fixedDataQueryOptions,
    queryFn: async () => {
      try {
        const wasm = await initWasm()
        return wasm
      } catch (err) {
        console.log('INIT WASM - ', err)
      }
    }
  })

  if (query.data !== undefined) {
    return <WalletCoreContext.Provider value={query.data}>{children}</WalletCoreContext.Provider>
  }

  if (query.error) {
    return <Label>{JSON.stringify(query.error)}</Label>
  }

  if (query.isPending) {
    return <Label>Loading...</Label>
  }

  return null
}

export const useWalletCore = () => useContext(WalletCoreContext)

export const useAssertWalletCore = () => shouldBePresent(useWalletCore())
