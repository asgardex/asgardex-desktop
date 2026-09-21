/**
 * Common NEP-141 tokens for the wallet whitelist / custom-token picker.
 * Hand-maintained (unlike THOR/MAYA generated ERC-20 lists).
 */
import { NEARChain } from '@xchainjs/xchain-near'
import { AssetType, TokenAsset } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

export const NEAR_TOKEN_WHITELIST: {
  asset: TokenAsset
  iconUrl: O.Option<string>
}[] = [
  {
    asset: {
      chain: NEARChain,
      symbol: 'USDC-17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
      ticker: 'USDC',
      type: AssetType.TOKEN
    },
    iconUrl: O.some('https://assets.coingecko.com/coins/images/6319/thumb/usdc.png?1696506694')
  },
  {
    asset: {
      chain: NEARChain,
      symbol: 'USDT-usdt.tether-token.near',
      ticker: 'USDT',
      type: AssetType.TOKEN
    },
    iconUrl: O.some('https://assets.coingecko.com/coins/images/325/thumb/Tether.png?1696501661')
  },
  {
    asset: {
      chain: NEARChain,
      symbol: 'wNEAR-wrap.near',
      ticker: 'wNEAR',
      type: AssetType.TOKEN
    },
    iconUrl: O.some('https://assets.coingecko.com/coins/images/10365/thumb/near.jpg?1696510367')
  },
  {
    asset: {
      chain: NEARChain,
      symbol: 'wBTC-2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near',
      ticker: 'wBTC',
      type: AssetType.TOKEN
    },
    iconUrl: O.some('https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png?1696507857')
  },
  {
    asset: {
      chain: NEARChain,
      symbol: 'ETH-eth.bridge.near',
      ticker: 'ETH',
      type: AssetType.TOKEN
    },
    iconUrl: O.some('https://assets.coingecko.com/coins/images/279/thumb/ethereum.png?1696501628')
  }
]
