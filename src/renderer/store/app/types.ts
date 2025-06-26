import { Chain } from '@xchainjs/xchain-util'

export type AppState = {
  isPrivate: boolean
  isWhitelistModalOpen: boolean
  protocol: Chain

  // slippage
  streamingSlip: number
  instantSlip: number
  tradeSlip: number
}
