import { Chain, CosmosChain } from '../Chain'
import { Coin, KnownCoinMetadata } from './Coin'

export const ibcTransferrableTokensPerChain: Partial<Record<CosmosChain, Pick<Coin, 'ticker' | 'id'>[]>> = {
  [Chain.Kujira]: [
    {
      ticker: 'LUNC',
      id: 'ibc/119334C55720942481F458C9C462F5C0CD1F1E7EEAC4679D674AA67221916AEA'
    },
    {
      ticker: 'ASTRO',
      id: 'ibc/640E1C3E28FD45F611971DF891AE3DC90C825DF759DF8FAA8F33F7F72B35AD56'
    },
    {
      ticker: 'LVN',
      id: 'ibc/B64A07C006C0F5E260A8AD50BD53568F1FD4A0D75B7A9F8765C81BEAFDA62053'
    },
    {
      ticker: 'rKUJI',
      id: 'factory/kujira1tsekaqv9vmem0zwskmf90gpf0twl6k57e8vdnq/urkuji'
    },
    {
      ticker: 'NSTK',
      id: 'factory/kujira1aaudpfr9y23lt9d45hrmskphpdfaq9ajxd3ukh/unstk'
    },
    {
      ticker: 'WINK',
      id: 'factory/kujira12cjjeytrqcj25uv349thltcygnp9k0kukpct0e/uwink'
    },
    {
      ticker: 'FUZN',
      id: 'factory/kujira1sc6a0347cc5q3k890jj0pf3ylx2s38rh4sza4t/ufuzn'
    },
    {
      ticker: 'USK',
      id: 'factory/kujira1qk00h5atutpsv900x202pxx42npjr9thg58dnqpa72f2p7m2luase444a7/uusk'
    },
    {
      ticker: 'NAMI',
      id: 'factory/kujira13x2l25mpkhwnwcwdzzd34cr8fyht9jlj7xu9g4uffe36g3fmln8qkvm3qn/unami'
    }
  ],

  [Chain.Cosmos]: [
    {
      ticker: 'USDC',
      id: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013'
    },
    {
      ticker: 'KUJI',
      id: 'ibc/4CC44260793F84006656DD868E017578F827A492978161DA31D7572BCB3F4289'
    },
    {
      ticker: 'rKUJI',
      id: 'ibc/50A69DC508ACCADE2DAC4B8B09AA6D9C9062FCBFA72BB4C6334367DECD972B06'
    },
    {
      ticker: 'WINK',
      id: 'ibc/4363FD2EF60A7090E405B79A6C4337C5E9447062972028F5A99FB041B9571942'
    },
    {
      ticker: 'LVN',
      id: 'ibc/6C95083ADD352D5D47FB4BA427015796E5FEF17A829463AD05ECD392EB38D889'
    },
    {
      ticker: 'NSTK',
      id: 'ibc/0B99C4EFF1BD05E56DEDEE1D88286DB79680C893724E0E7573BC369D79B5DDF3'
    },
    {
      ticker: 'USK',
      id: 'ibc/A47E814B0E8AE12D044637BCB4576FCA675EF66300864873FA712E1B28492B78'
    },
    {
      ticker: 'NAMI',
      id: 'ibc/4622E82B845FFC6AA8B45C1EB2F507133A9E876A5FEA1BA64585D5F564405453'
    },
    {
      ticker: 'FUZN',
      id: 'ibc/6BBBB4B63C51648E9B8567F34505A9D5D8BAAC4C31D768971998BE8C18431C26'
    }
  ],

  [Chain.Osmosis]: [
    {
      ticker: 'LVN',
      id: 'factory/osmo1mlng7pz4pnyxtpq0akfwall37czyk9lukaucsrn30ameplhhshtqdvfm5c/ulvn'
    },
    {
      ticker: 'USDC.eth.axl',
      id: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858'
    }
  ]
}

export const ibcTokens: KnownCoinMetadata[] = [
  { ticker: 'KUJI', logo: 'kuji', decimals: 6, priceProviderId: 'kujira' },
  {
    ticker: 'rKUJI',
    logo: 'rkuji.png',
    decimals: 6,
    priceProviderId: 'kujira'
  },
  {
    ticker: 'ASTRO',
    logo: 'terra-astroport.png',
    decimals: 6,
    priceProviderId: 'astroport-fi'
  },
  {
    ticker: 'WINK',
    logo: 'wink.png',
    decimals: 6,
    priceProviderId: 'winkhub'
  },
  {
    ticker: 'LVN',
    logo: 'levana',
    decimals: 6,
    priceProviderId: 'levana-protocol'
  },
  {
    ticker: 'NSTK',
    logo: 'nstk.png',
    decimals: 6,
    priceProviderId: 'unstake-fi'
  },
  {
    ticker: 'NAMI',
    logo: 'nami.png',
    decimals: 6,
    priceProviderId: 'nami-protocol'
  },
  {
    ticker: 'FUZN',
    logo: 'fuzn.png',
    decimals: 6,
    priceProviderId: 'fuzion'
  },
  { ticker: 'USK', logo: 'usk.png', decimals: 6, priceProviderId: 'usk' }
]
