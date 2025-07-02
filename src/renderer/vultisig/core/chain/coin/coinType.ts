import { WalletCore } from '@trustwallet/wallet-core'
import { CoinType } from '@trustwallet/wallet-core/dist/src/wallet-core'
import { match } from '../../../lib/utils/match'
import { Chain } from '../Chain'

type Input = {
  walletCore: WalletCore
  chain: Chain
}

export const getCoinType = ({ walletCore: { CoinType }, chain }: Input): CoinType =>
  match(chain, {
    [Chain.THORChain]: () => CoinType.thorchain,
    [Chain.MayaChain]: () => CoinType.thorchain,
    [Chain.Arbitrum]: () => CoinType.arbitrum,
    [Chain.Avalanche]: () => CoinType.avalancheCChain,
    [Chain.Base]: () => CoinType.base,
    [Chain.CronosChain]: () => CoinType.cronosChain,
    [Chain.BSC]: () => CoinType.smartChain,
    [Chain.Blast]: () => CoinType.blast,
    [Chain.Ethereum]: () => CoinType.ethereum,
    [Chain.Optimism]: () => CoinType.optimism,
    [Chain.Polygon]: () => CoinType.polygon,
    [Chain.Bitcoin]: () => CoinType.bitcoin,
    [Chain.BitcoinCash]: () => CoinType.bitcoinCash,
    [Chain.Litecoin]: () => CoinType.litecoin,
    [Chain.Dogecoin]: () => CoinType.dogecoin,
    [Chain.Dash]: () => CoinType.dash,
    [Chain.Solana]: () => CoinType.solana,
    [Chain.Cosmos]: () => CoinType.cosmos,
    [Chain.Kujira]: () => CoinType.kujira,
    [Chain.Dydx]: () => CoinType.dydx,
    [Chain.Polkadot]: () => CoinType.polkadot,
    [Chain.Sui]: () => CoinType.sui,
    [Chain.Zksync]: () => CoinType.zksync,
    [Chain.Ton]: () => CoinType.ton,
    [Chain.Osmosis]: () => CoinType.osmosis,
    [Chain.Terra]: () => CoinType.terraV2,
    [Chain.TerraClassic]: () => CoinType.terra,
    [Chain.Noble]: () => CoinType.noble,
    [Chain.Ripple]: () => CoinType.xrp,
    [Chain.Akash]: () => CoinType.akash,
    [Chain.Tron]: () => CoinType.tron,
    [Chain.Zcash]: () => CoinType.zcash
  })
