import { Chain } from '@xchainjs/xchain-util'

import { WalletAddress } from '../../../../shared/wallet/types'
import { PoolDetailRD as PoolDetailMayaRD } from '../../../services/mayaMigard/types'
import { PoolDetailRD, PoolShareRD } from '../../../services/midgard/types'
import { MimirHalt } from '../../../services/thorchain/types'
import { AssetWithDecimal } from '../../../types/asgardex'

export type Props = {
  asset: AssetWithDecimal
  poolShare: PoolShareRD
  poolDetail: PoolDetailRD | PoolDetailMayaRD
  dexWalletAddress: WalletAddress
  assetWalletAddress: WalletAddress
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}
