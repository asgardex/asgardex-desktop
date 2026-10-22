import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetType } from '@xchainjs/xchain-util'

import { AssetXRD } from '../../shared/utils/chainIds'
import { getRequiredProtocolsForAssets } from './assetProtocolHelper'

describe('assetProtocolHelper', () => {
  it('does not offer a swap protocol for native XRD', () => {
    const protocols = getRequiredProtocolsForAssets(
      AssetXRD,
      AssetBTC,
      () => true,
      () => true
    )

    expect(protocols).toEqual([])
  })

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
