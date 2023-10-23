import { AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBNB } from '@xchainjs/xchain-binance'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBCH } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { AssetATOM } from '@xchainjs/xchain-cosmos'
import { AssetDOGE } from '@xchainjs/xchain-doge'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetLTC } from '@xchainjs/xchain-litecoin'
import {
  AssetRune67C,
  AssetRuneB1A,
  AssetRuneNative,
  AssetRuneERC20,
  AssetRuneERC20Testnet
} from '@xchainjs/xchain-thorchain'
import { assetFromStringEx } from '@xchainjs/xchain-util'

const AssetSynthBtc = assetFromStringEx('BTC/BTC')
const AssetSynthBnb = assetFromStringEx('BNB/BNB')
const AssetSynthBusd = assetFromStringEx('BNB/BUSD-BD1')
const AssetSynthEth = assetFromStringEx('ETH/ETH')

// Re-export to have asset definition at one place only to handle xchain-* changes easily in the future
export {
  AssetBTC,
  AssetSynthBtc,
  AssetSynthBnb,
  AssetSynthBusd,
  AssetBNB,
  AssetBCH,
  AssetATOM,
  AssetLTC,
  AssetDOGE,
  AssetBSC,
  AssetAVAX,
  AssetETH,
  AssetSynthEth,
  AssetRune67C,
  AssetRuneB1A,
  AssetRuneNative,
  AssetRuneERC20,
  AssetRuneERC20Testnet
}
