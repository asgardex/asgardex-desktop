import type Transport from '@ledgerhq/hw-transport'
import { Network } from '@xchainjs/xchain-client'
import { ClientLedger, LTCChain, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'
import { VerifyAddressHandler } from '../types'
import { getDerivationPaths } from './common'

export const getAddress = async (
  transport: Transport,
  network: Network,
  walletAccount: number,
  walletIndex: number
): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const clientLedger = new ClientLedger({
      transport,
      ...defaultLtcParams,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })
    const ltcAddress = await clientLedger.getAddressAsync(walletIndex)
    return E.right({
      address: ltcAddress,
      chain: LTCChain,
      type: 'ledger',
      walletAccount,
      walletIndex,
      hdMode: 'default'
    })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Could not get address from Ledger's LTC app: ${
        isError(error) ? error?.message ?? error.toString() : `${error}`
      }`
    })
  }
}

export const verifyAddress: VerifyAddressHandler = async ({ transport, network, walletAccount, walletIndex }) => {
  const clientLedger = new ClientLedger({
    transport,
    ...defaultLtcParams,
    rootDerivationPaths: getDerivationPaths(walletAccount, network),
    network: network
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
