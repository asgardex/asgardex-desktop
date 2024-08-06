import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

export const CHAIN_STRINGS: Record<Chain, string> = {
  [BCHChain]: 'Bitcoin Cash',
  [BTCChain]: 'Bitcoin',
  [GAIAChain]: 'GAIA',
  [DOGEChain]: 'Dogecoin',
  [ETHChain]: 'Ethereum',
  [LTCChain]: 'Litecoin',
  [THORChain]: 'THORChain',
  [ARBChain]: 'Arbitrum',
  [AVAXChain]: 'Avax',
  [BSCChain]: 'BNB Chain (BSC)',
  [MAYAChain]: 'MAYAChain',
  [DASHChain]: 'DASH',
  [KUJIChain]: 'KUJI'
}

export const DEFAULT_ENABLED_CHAINS: Record<Chain, string> = {
  [BCHChain]: CHAIN_STRINGS[BCHChain],
  [BTCChain]: CHAIN_STRINGS[BTCChain],
  [GAIAChain]: CHAIN_STRINGS[GAIAChain],
  [DOGEChain]: CHAIN_STRINGS[DOGEChain],
  [ETHChain]: CHAIN_STRINGS[ETHChain],
  [LTCChain]: CHAIN_STRINGS[LTCChain],
  [THORChain]: CHAIN_STRINGS[THORChain],
  [ARBChain]: CHAIN_STRINGS[ARBChain],
  [AVAXChain]: CHAIN_STRINGS[AVAXChain],
  [BSCChain]: CHAIN_STRINGS[BSCChain],
  [MAYAChain]: CHAIN_STRINGS[MAYAChain],
  [DASHChain]: CHAIN_STRINGS[DASHChain],
  [KUJIChain]: CHAIN_STRINGS[KUJIChain]
}
