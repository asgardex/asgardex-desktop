import { Network } from '@xchainjs/xchain-client'

import { AssetWithAmount } from '../../../types/asgardex'

export type ActionProps = {
  network: Network
  incomes: AssetWithAmount[]
  outgos: AssetWithAmount[]
  fees?: AssetWithAmount[]
  /**
   * Possible transaction slip in percents
   */
  slip?: number
  className?: string
  isDesktopView: boolean
}
