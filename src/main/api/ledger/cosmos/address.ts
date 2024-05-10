import type Transport from '@ledgerhq/hw-transport'
import { Network } from '@xchainjs/xchain-client'
import { ClientLedger, GAIAChain, defaultClientConfig } from '@xchainjs/xchain-cosmos'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'

export const getAddress = async (
  transport: Transport,
  walletIndex: number,
  network: Network
): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const clientLedger = new ClientLedger({ transport, ...defaultClientConfig, network: network })
    const address = await clientLedger.getAddressAsync(walletIndex)

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.GET_ADDRESS_FAILED,
        msg: `Getting 'address' from Ledger's Cosmos app failed`
      })
    }
    return E.right({ address, chain: GAIAChain, type: 'ledger', walletIndex, hdMode: 'default' })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}

export const verifyAddress = async (transport: Transport, walletIndex: number, network: Network) => {
  const clientLedger = new ClientLedger({ transport, ...defaultClientConfig, network: network })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
