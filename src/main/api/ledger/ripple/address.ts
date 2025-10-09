import type Transport from '@ledgerhq/hw-transport'
import { Network } from '@xchainjs/xchain-client'
import { ClientLedger, XRPChain, defaultXRPParams } from '@xchainjs/xchain-ripple'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress, WalletType } from '../../../../shared/wallet/types'
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
      ...defaultXRPParams,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })
    const address = await clientLedger.getAddressAsync(walletIndex)

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.GET_ADDRESS_FAILED,
        msg: `Getting 'address' from Ledger's XRP app failed`
      })
    }
    return E.right({
      address,
      chain: XRPChain,
      type: WalletType.Ledger,
      walletAccount,
      walletIndex,
      hdMode: 'default'
    })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}

export const verifyAddress = async (
  transport: Transport,
  walletAccount: number,
  walletIndex: number,
  network: Network
) => {
  const clientLedger = new ClientLedger({
    transport,
    ...defaultXRPParams,
    rootDerivationPaths: getDerivationPaths(walletAccount, network),
    network: network
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
