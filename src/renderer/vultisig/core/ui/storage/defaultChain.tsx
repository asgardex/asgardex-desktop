import { useQuery } from '@tanstack/react-query'
import { fixedDataQueryOptions } from '../../../lib/ui/query/utils/options'
import { Chain } from '../../chain/Chain'

import { StorageKey } from './StorageKey'

type GetDefaultChainsFunction = () => Promise<Chain[]>

export type DefaultChainsStorage = {
  getDefaultChains: GetDefaultChainsFunction
}

export const initialDefaultChains = [Chain.Bitcoin, Chain.Ethereum, Chain.THORChain, Chain.Solana, Chain.BSC]

export const useDefaultChainsQuery = () => {
  return useQuery({
    queryKey: [StorageKey.defaultChains],
    queryFn: () => initialDefaultChains,
    ...fixedDataQueryOptions
  })
}
