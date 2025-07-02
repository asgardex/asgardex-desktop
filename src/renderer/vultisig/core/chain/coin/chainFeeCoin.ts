import { recordMap } from '../../../lib/utils/record/recordMap'
import { Chain, EthereumL2Chain } from '../Chain'
import { kujiraCoinsMigratedToThorChainMetadata } from '../chains/cosmos/thor/kujira-merge'
import { KnownCoin, KnownCoinMetadata } from '../coin/Coin'

const ether: KnownCoinMetadata = {
  ticker: 'ETH',
  logo: 'eth',
  decimals: 18,
  priceProviderId: 'ethereum'
}

const leanChainFeeCoin: Record<Chain, KnownCoinMetadata> = {
  [Chain.Bitcoin]: {
    ticker: 'BTC',
    logo: 'btc',
    decimals: 8,
    priceProviderId: 'bitcoin'
  },
  [Chain.BitcoinCash]: {
    ticker: 'BCH',
    logo: 'bch',
    decimals: 8,
    priceProviderId: 'bitcoin-cash'
  },
  [Chain.Litecoin]: {
    ticker: 'LTC',
    logo: 'ltc',
    decimals: 8,
    priceProviderId: 'litecoin'
  },
  [Chain.Dogecoin]: {
    ticker: 'DOGE',
    logo: 'doge',
    decimals: 8,
    priceProviderId: 'dogecoin'
  },
  [Chain.Dash]: {
    ticker: 'DASH',
    logo: 'dash',
    decimals: 8,
    priceProviderId: 'dash'
  },
  [Chain.Ripple]: {
    ticker: 'XRP',
    logo: 'xrp',
    decimals: 6,
    priceProviderId: 'ripple'
  },
  [Chain.THORChain]: {
    ticker: 'RUNE',
    logo: 'rune',
    decimals: 8,
    priceProviderId: 'thorchain'
  },
  [Chain.MayaChain]: {
    ticker: 'CACAO',
    logo: 'cacao',
    decimals: 10,
    priceProviderId: 'cacao'
  },
  [Chain.Solana]: {
    ticker: 'SOL',
    logo: 'solana',
    decimals: 9,
    priceProviderId: 'solana'
  },
  [Chain.Ton]: {
    ticker: 'TON',
    logo: 'ton',
    decimals: 9,
    priceProviderId: 'the-open-network'
  },
  [Chain.Ethereum]: ether,
  [Chain.Avalanche]: {
    ticker: 'AVAX',
    logo: 'avax',
    decimals: 18,
    priceProviderId: 'avalanche-2'
  },
  [Chain.BSC]: {
    ticker: 'BNB',
    logo: 'bsc',
    decimals: 18,
    priceProviderId: 'binancecoin'
  },

  [Chain.Polygon]: {
    ticker: 'MATIC',
    logo: 'matic',
    decimals: 18,
    priceProviderId: 'matic-network'
  },

  [Chain.CronosChain]: {
    ticker: 'CRO',
    logo: 'cro',
    decimals: 18,
    priceProviderId: 'crypto-com-chain'
  },
  [Chain.Dydx]: {
    ticker: 'DYDX',
    logo: 'dydx',
    decimals: 18,
    priceProviderId: 'dydx-chain'
  },
  [Chain.Kujira]: {
    ...kujiraCoinsMigratedToThorChainMetadata.kuji,
    decimals: 6
  },
  [Chain.Terra]: {
    ticker: 'LUNA',
    logo: 'luna',
    decimals: 6,
    priceProviderId: 'terra-luna-2'
  },
  [Chain.TerraClassic]: {
    ticker: 'LUNC',
    logo: 'lunc',
    decimals: 6,
    priceProviderId: 'terra-luna'
  },
  [Chain.Sui]: {
    ticker: 'SUI',
    logo: 'sui',
    decimals: 9,
    priceProviderId: 'sui'
  },
  [Chain.Polkadot]: {
    ticker: 'DOT',
    logo: 'dot',
    decimals: 10,
    priceProviderId: 'polkadot'
  },
  [Chain.Noble]: {
    ticker: 'USDC',
    logo: 'usdc',
    decimals: 6,
    priceProviderId: 'usd-coin'
  },
  [Chain.Akash]: {
    ticker: 'AKT',
    logo: 'akash',
    decimals: 6,
    priceProviderId: 'akash-network'
  },
  [Chain.Cosmos]: {
    ticker: 'ATOM',
    logo: 'atom',
    decimals: 6,
    priceProviderId: 'cosmos'
  },
  [Chain.Osmosis]: {
    ticker: 'OSMO',
    logo: 'osmo',
    decimals: 6,
    priceProviderId: 'osmosis'
  },
  [Chain.Tron]: {
    ticker: 'TRX',
    logo: 'tron',
    decimals: 6,
    priceProviderId: 'tron'
  },
  ...recordMap(EthereumL2Chain, () => ether),
  [Chain.Zcash]: {
    ticker: 'ZEC',
    logo: 'zec',
    decimals: 8,
    priceProviderId: 'zcash'
  }
}

export const chainFeeCoin: Record<Chain, KnownCoin> = recordMap(leanChainFeeCoin, (coin, chain) => ({
  ...coin,
  chain,
  id: coin.ticker
}))
