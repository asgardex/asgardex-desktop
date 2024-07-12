import type Transport from '@ledgerhq/hw-transport'
import { BTCChain, ClientLedger } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'
import { VerifyAddressHandler } from '../types'
import { btcInitParams, getDerivationPaths } from './common'

export const verifyAddress: VerifyAddressHandler = async ({ transport, network, walletAccount, walletIndex }) => {
  const clientLedger = new ClientLedger({
    transport,
    ...btcInitParams,
    rootDerivationPaths: getDerivationPaths(walletAccount, network),
    network: network
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}

export const getAddress = async (
  transport: Transport,
  network: Network,
  walletAccount: number,
  walletIndex: number
): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const clientLedger = new ClientLedger({
      transport,
      ...btcInitParams,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })
    const address = await clientLedger.getAddressAsync(walletIndex)
    return E.right({ address: address, chain: BTCChain, type: 'ledger', walletAccount, walletIndex, hdMode: 'default' })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Could not get address from Ledger's BTC app: ${
        isError(error) ? error?.message ?? error.toString() : `${error}`
      }`
    })
  }
}
