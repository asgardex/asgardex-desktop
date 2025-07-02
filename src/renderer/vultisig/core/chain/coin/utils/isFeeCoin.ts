import { chainFeeCoin } from '../chainFeeCoin'
import { areEqualCoins, CoinKey } from '../Coin'

export const isFeeCoin = (coin: CoinKey) => areEqualCoins(coin, chainFeeCoin[coin.chain])
