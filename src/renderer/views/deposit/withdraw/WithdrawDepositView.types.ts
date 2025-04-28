import { Chain } from '@xchainjs/xchain-util'

import { WalletAddress } from '../../../../shared/wallet/types'
import { PoolDetailRD as PoolDetailMayaRD } from '../../../services/midgard/mayaMigard/types'
import { PoolDetailRD, PoolShareRD } from '../../../services/midgard/midgardTypes'
import { MimirHalt } from '../../../services/thorchain/types'
import { AssetWithDecimal } from '../../../types/asgardex'

export type Props = {
  protocol: Chain
  asset: AssetWithDecimal
  poolShare: PoolShareRD
  poolDetail: PoolDetailRD | PoolDetailMayaRD
  dexWalletAddress: WalletAddress
  assetWalletAddress: WalletAddress
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}
