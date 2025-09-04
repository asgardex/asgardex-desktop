import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'

export const chainToProtocol = {
  [THORChain]: 'THORChain',
  [MAYAChain]: 'MAYAChain'
}

export const protocolMapping = {
  Thorchain: 'THORChain',
  Mayachain: 'MAYAChain',
  Chainflip: 'Chainflip'
}
