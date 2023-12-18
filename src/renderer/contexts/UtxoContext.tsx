import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { Chain } from '@xchainjs/xchain-util'

import { useBitcoinCashContext } from './BitcoinCashContext'
import { useBitcoinContext } from './BitcoinContext'
import { useLitecoinContext } from './LitecoinContext'

export const useUtxoContext = (chain: Chain) => {
  const btcContext = useBitcoinContext()
  const ltcContext = useLitecoinContext()
  const bchContext = useBitcoinCashContext()
  const dogeContext = useBitcoinContext()

  switch (chain) {
    case BTCChain:
      return btcContext
    case LTCChain:
      return ltcContext
    case BCHChain:
      return bchContext
    case DOGEChain:
      return dogeContext
    default:
      return btcContext
  }
}
