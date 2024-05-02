import type Transport from '@ledgerhq/hw-transport'
import { BCHChain, ClientLedger, defaultBchParams } from '@xchainjs/xchain-bitcoincash'
import { Network } from '@xchainjs/xchain-client'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'
import { VerifyAddressHandler } from '../types'

export const getAddress = async (
  transport: Transport,
  network: Network,
  walletIndex: number
): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const clientLedger = new ClientLedger({ transport, ...defaultBchParams, network: network })
    const bchAddress = await clientLedger.getAddressAsync(walletIndex)
    return E.right({ address: bchAddress, chain: BCHChain, type: 'ledger', walletIndex, hdMode: 'default' })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Could not get address from Ledger's BCH app: ${
        isError(error) ? error?.message ?? error.toString() : `${error}`
      }`
    })
  }
}
export const verifyAddress: VerifyAddressHandler = async ({ transport, network, walletIndex }) => {
  const clientLedger = new ClientLedger({ transport, ...defaultBchParams, network: network })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
