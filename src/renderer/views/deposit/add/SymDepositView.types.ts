import { Chain } from '@xchainjs/xchain-util'

import { WalletAddress, WalletType } from '../../../../shared/wallet/types'
import { PoolDetailRD as PoolDetailMayaRD } from '../../../services/midgard/mayaMidgard/types'
import { PoolDetailRD } from '../../../services/midgard/midgardTypes'
import { MimirHalt } from '../../../services/thorchain/types'
import { AssetWithDecimal } from '../../../types/asgardex'

export type Props = {
  asset: AssetWithDecimal
  poolDetail: PoolDetailRD | PoolDetailMayaRD
  haltedChains: Chain[]
  mimirHalt: MimirHalt
  dexWalletAddress: WalletAddress
  assetWalletAddress: WalletAddress
  assetWalletType: WalletType
  dexWalletType: WalletType
}
