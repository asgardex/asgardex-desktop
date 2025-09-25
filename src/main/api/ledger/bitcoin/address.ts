import type Transport from '@ledgerhq/hw-transport'
import {
  AddressFormat,
  BTCChain,
  ClientLedger,
  defaultBTCParams,
  tapRootDerivationPaths
} from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { HDMode, WalletAddress, WalletType } from '../../../../shared/wallet/types'
import { getDerivationPaths, hdModeToDerivationPathType } from './common'

export const verifyAddress = async ({
  transport,
  network,
  walletAccount,
  walletIndex,
  hdMode,
  addressFormat
}: {
  transport: Transport
  network: Network
  walletAccount: number
  walletIndex: number
  hdMode?: HDMode
  addressFormat?: AddressFormat
}) => {
  // Determine address format based on hdMode if not explicitly provided
  let finalAddressFormat: AddressFormat = AddressFormat.P2WPKH
  if (addressFormat !== undefined) {
    finalAddressFormat = addressFormat
  } else if (hdMode === 'p2tr') {
    finalAddressFormat = AddressFormat.P2TR
  }

  const clientLedger = new ClientLedger({
    transport,
    ...defaultBTCParams,
    addressFormat: finalAddressFormat,
    rootDerivationPaths:
      finalAddressFormat === AddressFormat.P2TR
        ? tapRootDerivationPaths
        : getDerivationPaths(walletAccount, network, hdModeToDerivationPathType(hdMode)),
    network: network
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}

export const getAddress = async (
  transport: Transport,
  network: Network,
  walletAccount: number,
  walletIndex: number,
  hdMode?: HDMode,
  addressFormat?: AddressFormat
): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    // Determine address format based on hdMode if not explicitly provided
    let finalAddressFormat: AddressFormat = AddressFormat.P2WPKH
    if (addressFormat !== undefined) {
      finalAddressFormat = addressFormat
    } else if (hdMode === 'p2tr') {
      finalAddressFormat = AddressFormat.P2TR
    }

    const clientLedger = new ClientLedger({
      transport,
      ...defaultBTCParams,
      addressFormat: finalAddressFormat,
      rootDerivationPaths:
        finalAddressFormat === AddressFormat.P2TR
          ? tapRootDerivationPaths
          : getDerivationPaths(walletAccount, network, hdModeToDerivationPathType(hdMode)),
      network: network
    })
    const address = await clientLedger.getAddressAsync(walletIndex)
    return E.right({
      address: address,
      chain: BTCChain,
      type: WalletType.Ledger,
      walletAccount,
      walletIndex,
      hdMode: hdMode || 'default'
    })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Could not get address from Ledger's BTC app: ${
        isError(error) ? error?.message ?? error.toString() : `${error}`
      }`
    })
  }
}
