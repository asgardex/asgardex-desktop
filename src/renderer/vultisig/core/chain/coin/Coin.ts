import { pick } from '../../../lib/utils/record/pick'
import { RequiredFields } from '../../../lib/utils/types/RequiredFields'

import { Chain } from '../Chain'
import { ChainEntity } from '../ChainEntity'
import { chainFeeCoin } from './chainFeeCoin'
import { chainTokens } from './chainTokens'

export type CoinKey<T extends Chain = Chain> = ChainEntity<T> & {
  id: string
}

export type CoinMetadata = {
  priceProviderId?: string
  decimals: number
  ticker: string
  logo?: string
}

export type Coin = CoinKey & CoinMetadata

// Coin metadata coming from autodiscovery might miss logo field,
// but all coins defined in the codebase should have logo field.
export type KnownCoinMetadata = RequiredFields<CoinMetadata, 'logo'>
export type KnownCoin = CoinKey & KnownCoinMetadata

export const coinMetadataFields: (keyof Coin)[] = ['priceProviderId', 'decimals', 'ticker', 'logo']

export type CoinAmount = {
  decimals: number
  amount: bigint
}

export const areEqualCoins = (one: CoinKey, another: CoinKey): boolean =>
  one.chain === another.chain && one.id.toLowerCase() === another.id.toLowerCase()

export const coinKeyToString = (coin: CoinKey): string => `${coin.chain}:${coin.id}`

export const getCoinFromCoinKey = (coinKey: CoinKey): Coin | undefined => {
  const tokens = chainTokens[coinKey.chain]
  if (tokens) {
    const foundToken = tokens.find((token) => token.id === coinKey.id)
    if (foundToken) return foundToken
  }

  const feeCoin = chainFeeCoin[coinKey.chain]
  if (feeCoin && feeCoin.id === coinKey.id) {
    return feeCoin
  }

  return undefined
}

export const extractCoinKey = <T extends CoinKey>(coin: T): CoinKey => pick(coin, ['chain', 'id'])
