import { withoutUndefined } from '../../../../lib/utils/array/withoutUndefined'
import { Chain } from '../../Chain'
import { Coin, KnownCoin } from '../Coin'
import { ibcTokens } from '../ibc'

export const getMissingIBCTokens = (
  existing: KnownCoin[],
  ibcMeta: Pick<Coin, 'ticker' | 'id'>[],
  chain: Chain
): KnownCoin[] => {
  const key = (t: { ticker: string; decimals: number }) => `${t.ticker}:${t.decimals}`
  const seen = new Set(existing.map(key))

  return withoutUndefined(
    ibcTokens
      .filter((t) => !seen.has(key(t)))
      .map((t) => {
        const meta = ibcMeta.find((i) => i.ticker === t.ticker)
        return meta ? { ...t, chain, id: meta.id } : undefined
      })
  )
}
