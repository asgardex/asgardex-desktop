import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { Chain } from '@xchainjs/xchain-util'

import { useArbContext } from './ArbContext'
import { useAvaxContext } from './AvaxContext'
import { useBscContext } from './BscContext'
import { useEthereumContext } from './EthereumContext'

export const useEvmContext = (chain: Chain) => {
  const EthContext = useEthereumContext()
  const ArbContext = useArbContext()
  const AvaxContext = useAvaxContext()
  const BscContext = useBscContext()
  switch (chain) {
    case ETHChain:
      return EthContext
    case ARVChain:
      return ArbContext
    case AVAXChain:
      return AvaxContext
    case BSCChain:
      return BscContext
    default:
      return EthContext
  }
}
