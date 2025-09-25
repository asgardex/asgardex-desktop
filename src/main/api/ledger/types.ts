import type Transport from '@ledgerhq/hw-transport'
import { AddressFormat } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'

import { HDMode } from '../../../shared/wallet/types'

export type VerifyAddressHandler = (params: {
  transport: Transport
  network: Network
  walletAccount: number
  walletIndex: number
  hdMode?: HDMode
  addressFormat?: AddressFormat
}) => Promise<boolean>
