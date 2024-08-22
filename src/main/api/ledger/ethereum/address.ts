import type Transport from '@ledgerhq/hw-transport'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import * as ETH from '@xchainjs/xchain-evm'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultEthParams } from '../../../../shared/ethereum/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'

export const getAddress = async ({
  transport,
  walletAccount,
  walletIndex,
  evmHDMode,
  network
}: {
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
  network: Network
}): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const ledgerClient = new ETH.ClientLedger({
      ...defaultEthParams,
      signer: new ETH.LedgerSigner({
        transport,
        provider: defaultEthParams.providers[Network.Mainnet],
        derivationPath: getDerivationPath(walletAccount, walletIndex, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, evmHDMode),
      network
    })
    const address = await ledgerClient.getAddressAsync(walletIndex)
    if (address) {
      return E.right({ address, chain: ETHChain, type: 'ledger', walletAccount, walletIndex, hdMode: evmHDMode })
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
  transport,
  walletAccount,
  walletIndex,
  evmHDMode,
  network
}: {
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
  network: Network
}) => {
  const ledgerClient = new ETH.ClientLedger({
    ...defaultEthParams,
    signer: new ETH.LedgerSigner({
      transport,
      provider: defaultEthParams.providers[Network.Mainnet],
      derivationPath: getDerivationPath(walletAccount, walletIndex, evmHDMode)
    }),
    rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, evmHDMode),
    network
  })
  const _ = await ledgerClient.getAddressAsync(walletIndex, true)
  return true
}
