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
import { Asset, assetFromStringEx } from '@xchainjs/xchain-util'

const AssetSynthBtc = assetFromStringEx('BTC/BTC')
const AssetSynthBusd = assetFromStringEx('BNB/BUSD-BD1')
const AssetSynthEth = assetFromStringEx('ETH/ETH')
const AssetSynthEthUsdc = assetFromStringEx('ETH/USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')
const AssetSynthEthUsdt = assetFromStringEx('ETH/USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7')
const AssetSynthLTC = assetFromStringEx('LTC/LTC')
const AssetSynthAVAX = assetFromStringEx('AVAX/AVAX')
const AssetSynthAVAXUSDC = assetFromStringEx('AVAX/USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E')
const AssetSynthATOM = assetFromStringEx('GAIA/ATOM')
const AssetSynthDOGE = assetFromStringEx('DOGE/DOGE')
const AssetSynthKuji = assetFromStringEx('KUJI/KUJI')
const AssetSynthUsk = assetFromStringEx('KUJI/USK')
const AssetSynthBCH = assetFromStringEx('BCH/BCH')
const AssetSynthBSC = assetFromStringEx('BSC/BNB')
const AssetSynthDash = assetFromStringEx('DASH/DASH')

// Re-export to have asset definition at one place only to handle xchain-* changes easily in the future
export {
  AssetBTC,
  AssetCacao,
  AssetMaya,
  AssetSynthBtc,
  AssetSynthBusd,
  AssetSynthLTC,
  AssetSynthAVAX,
  AssetSynthAVAXUSDC,
  AssetSynthDOGE,
  AssetSynthKuji,
  AssetSynthEth,
  AssetSynthEthUsdc,
  AssetSynthBCH,
  AssetSynthATOM,
  AssetSynthBSC,
  AssetBCH,
  AssetATOM,
  AssetLTC,
  AssetDOGE,
  AssetBSC,
  AssetAVAX,
  AssetETH,
  AssetRuneNative,
  AssetSynthEthUsdt,
  AssetKUJI,
  AssetSynthUsk,
  AssetSynthDash
}

/** Moved from Binance Helpers
 *  Checks to see if the second part od the symbol has a len of 4 and ends with M.
 * I suspect this is old school BNB specific stuff. Will leave for now as it is used in Midgard Service and by util.tests
 */
export const isMiniToken = ({ symbol }: Pick<Asset, 'symbol'>): boolean => {
  const [, two] = symbol.split('-')
  return two?.length === 4 && two?.endsWith('M')
}
