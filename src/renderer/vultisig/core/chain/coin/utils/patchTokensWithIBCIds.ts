import { Coin, KnownCoin } from '../Coin'

export const patchTokensWithIBCIds = (tokens: KnownCoin[], ibcTokens: Pick<Coin, 'ticker' | 'id'>[]): KnownCoin[] =>
  tokens.map((token) => {
    if (token.id) return token
    const match = ibcTokens.find((i) => i.ticker === token.ticker)
    return match ? { ...token, id: match.id } : token
  })
