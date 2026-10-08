import { AssetBTC } from '@xchainjs/xchain-bitcoin'

import { AssetXRD } from '../../shared/radix'
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
})
