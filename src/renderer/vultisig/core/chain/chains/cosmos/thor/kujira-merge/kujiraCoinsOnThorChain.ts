import { mirrorRecord } from '../../../../../../lib/utils/record/mirrorRecord'
import { recordMap } from '../../../../../../lib/utils/record/recordMap'

import { Chain } from '../../../../Chain'
import { chainFeeCoin } from '../../../../coin/chainFeeCoin'
import { KnownCoinMetadata } from '../../../../coin/Coin'
import { kujiraCoinMigratedToThorChainDestinationId, kujiraCoinsMigratedToThorChainMetadata } from '.'

export const kujiraCoinsOnThorChain: Record<string, KnownCoinMetadata> = recordMap(
  mirrorRecord(kujiraCoinMigratedToThorChainDestinationId),
  (coin) => {
    const metadata = kujiraCoinsMigratedToThorChainMetadata[coin]
    const decimals = chainFeeCoin[Chain.THORChain].decimals

    return {
      ...metadata,
      decimals
    }
  }
)
