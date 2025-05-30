import * as Transport from '@ledgerhq/hw-transport'
import { Network } from '@xchainjs/xchain-client'

export type VerifyAddressHandler = (params: {
  transport: Transport.default
  network: Network
  walletAccount: number
  walletIndex: number
}) => Promise<boolean>
