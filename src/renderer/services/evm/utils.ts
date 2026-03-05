import { AnyAsset } from '@xchainjs/xchain-util'

// BSC USDT symbol fix — temporary workaround
const targetSymbol = 'BSC-USD-0x55d398326f99059ff775485246999027b3197955'
const newSymbol = 'USDT-0x55d398326f99059fF775485246999027B3197955'
const newTicker = 'USDT'

export const replaceSymbol = (asset: AnyAsset): AnyAsset => {
  if (asset.symbol === targetSymbol) {
    return { ...asset, symbol: newSymbol, ticker: newTicker }
  }
  return asset
}
