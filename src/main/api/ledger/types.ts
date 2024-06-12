import Transport from '@ledgerhq/hw-transport'
import { Network } from '@xchainjs/xchain-client'

export type VerifyAddressHandler = (params: {
  transport: Transport
  network: Network
  walletAccount: number
  walletIndex: number
}) => Promise<boolean>
