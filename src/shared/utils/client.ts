import * as Client from '@xchainjs/xchain-client'
import { Network } from '@xchainjs/xchain-client'
// tobefixed
export const toClientNetwork = (network: string): Client.Network => {
  switch (network) {
    case Network.Mainnet:
      return Client.Network.Mainnet
    case Network.Stagenet:
      return Client.Network.Stagenet
    case Network.Testnet:
      return Client.Network.Testnet
    default:
      return Client.Network.Mainnet
  }
}
