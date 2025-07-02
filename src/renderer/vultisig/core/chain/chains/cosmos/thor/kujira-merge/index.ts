import { makeRecord } from '../../../../../../lib/utils/record/makeRecord'

import { KnownCoinMetadata } from '../../../../coin/Coin'

const kujiraCoinsMigratedToThorChain = ['kuji', 'rkuji', 'fuzn', 'nstk', 'wink', 'lvn'] as const

type KujiraCoinMigratedToThorChain = typeof kujiraCoinsMigratedToThorChain[number]

export const kujiraCoinThorChainMergeContracts: Record<KujiraCoinMigratedToThorChain, string> = {
  kuji: 'thor14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s3p2nzy',
  rkuji: 'thor1yyca08xqdgvjz0psg56z67ejh9xms6l436u8y58m82npdqqhmmtqrsjrgh',
  fuzn: 'thor1suhgf5svhu4usrurvxzlgn54ksxmn8gljarjtxqnapv8kjnp4nrsw5xx2d',
  nstk: 'thor1cnuw3f076wgdyahssdkd0g3nr96ckq8cwa2mh029fn5mgf2fmcmsmam5ck',
  wink: 'thor1yw4xvtc43me9scqfr2jr2gzvcxd3a9y4eq7gaukreugw2yd2f8tsz3392y',
  lvn: 'thor1ltd0maxmte3xf4zshta9j5djrq9cl692ctsp9u5q0p9wss0f5lms7us4yf'
}

// decimals will be different on ThorChain and Kujira
export const kujiraCoinsMigratedToThorChainMetadata: Record<
  KujiraCoinMigratedToThorChain,
  Omit<KnownCoinMetadata, 'decimals'>
> = {
  kuji: {
    ticker: 'KUJI',
    logo: 'kuji',
    priceProviderId: 'kujira'
  },
  rkuji: {
    ticker: 'rKUJI',
    logo: 'rkuji.png',
    priceProviderId: 'kujira'
  },
  fuzn: {
    ticker: 'FUZN',
    logo: 'fuzn.png',
    priceProviderId: 'fuzion'
  },
  lvn: {
    ticker: 'LVN',
    logo: 'levana',
    priceProviderId: 'levana-protocol'
  },
  nstk: {
    ticker: 'NSTK',
    logo: 'nstk.png',
    priceProviderId: 'unstake-fi'
  },
  wink: {
    ticker: 'WINK',
    logo: 'wink.png',
    priceProviderId: 'winkhub'
  }
}

export const kujiraCoinMigratedToThorChainDestinationId: Record<KujiraCoinMigratedToThorChain, string> = makeRecord(
  kujiraCoinsMigratedToThorChain,
  (id) => `thor.${id}`
)
