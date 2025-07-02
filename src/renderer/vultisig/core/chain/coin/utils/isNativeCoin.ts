import { chainNativeTokens } from '../chainTokens'
import { CoinKey } from '../Coin'
import { isFeeCoin } from './isFeeCoin'

export const isNativeCoin = (coin: CoinKey) => {
  if (isFeeCoin(coin)) {
    return true
  }

  return chainNativeTokens[coin.chain]?.some((nativeCoin) => nativeCoin.id === coin.id)
}
