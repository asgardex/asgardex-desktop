import { AssetARB } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBCH } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { AssetATOM } from '@xchainjs/xchain-cosmos'
import { AssetDOGE } from '@xchainjs/xchain-doge'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetKUJI } from '@xchainjs/xchain-kujira'
import { AssetLTC } from '@xchainjs/xchain-litecoin'
import { AssetCacao, AssetMaya } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'

// Re-export to have asset definition at one place only to handle xchain-* changes easily in the future
export {
  AssetBTC,
  AssetCacao,
  AssetMaya,
  AssetBCH,
  AssetATOM,
  AssetLTC,
  AssetDOGE,
  AssetBSC,
  AssetARB,
  AssetAVAX,
  AssetETH,
  AssetRuneNative,
  AssetKUJI
}
