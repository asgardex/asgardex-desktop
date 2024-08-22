import type Transport from '@ledgerhq/hw-transport'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import * as BSC from '@xchainjs/xchain-evm'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultBscParams } from '../../../../shared/bsc/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'

export const getAddress = async ({
  walletAccount,
  walletIndex,
  evmHDMode,
  transport,
  network
}: {
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
  network: Network
}): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const clientLedger = new BSC.ClientLedger({
      ...defaultBscParams,
      signer: new BSC.LedgerSigner({
        transport,
        provider: defaultBscParams.providers[Network.Mainnet],
        derivationPath: getDerivationPath(walletAccount, walletIndex, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, evmHDMode),
      network
    })
    const address = await clientLedger.getAddressAsync(walletIndex)
    if (address) {
      return E.right({ address, chain: BSCChain, type: 'ledger', walletAccount, walletIndex, hdMode: evmHDMode })
    } else {
      return E.left({
        errorId: LedgerErrorId.INVALID_PUBKEY,
        msg: `Could not get address from Ledger's Ethereum App`
      })
    }
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}

export const verifyAddress = async ({
  walletAccount,
  walletIndex,
  evmHDMode,
  transport
}: {
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
}) => {
  const clientLedger = new BSC.ClientLedger({
    ...defaultBscParams,
    signer: new BSC.LedgerSigner({
      transport,
      provider: defaultBscParams.providers[Network.Mainnet],
      derivationPath: getDerivationPath(walletAccount, walletIndex, evmHDMode)
    }),
    rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, evmHDMode)
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
