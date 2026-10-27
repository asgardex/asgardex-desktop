import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetType } from '@xchainjs/xchain-util'

import { getRequiredProtocolsForAssets } from './assetProtocolHelper'

describe('assetProtocolHelper', () => {
  it('quotes an ETH trade asset on THORChain and MAYAChain', () => {
    const protocols = getRequiredProtocolsForAssets(
      { chain: 'ETH', symbol: 'ETH', ticker: 'ETH', type: AssetType.TRADE },
      AssetBTC,
      () => false,
      () => false
    )

    expect(protocols).toEqual(['Thorchain', 'Mayachain'])
  })
})
