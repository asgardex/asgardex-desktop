import type Transport from '@ledgerhq/hw-transport'
import { Network } from '@xchainjs/xchain-client'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import { Chain } from '@xchainjs/xchain-util'
import log from 'electron-log'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress, WalletType } from '../../../../shared/wallet/types'
import { EVM_LEDGER_CHAINS, resolveEvmProvider } from './common'

export const getEVMAddress = async ({
  chain,
  transport,
  walletAccount,
  walletIndex,
  evmHDMode,
  network
}: {
  chain: Chain
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
  network: Network
}): Promise<E.Either<LedgerError, WalletAddress>> => {
  const config = EVM_LEDGER_CHAINS[chain]
  if (!config) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Unsupported chain: ${chain}`
    })
  }

  const provider = resolveEvmProvider(config, network)

  const clientParams = {
    ...config.defaultParams,
    signer: new LedgerSigner({
      transport,
      provider,
      derivationPath: getDerivationPath(walletAccount, evmHDMode)
    }),
    rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
    network
  }

  try {
    const client = new ClientLedger(clientParams)
    const address = await client.getAddressAsync(walletIndex)

    if (address) {
      return E.right({ address, chain: chain, type: WalletType.Ledger, walletAccount, walletIndex, hdMode: evmHDMode })
    } else {
      return E.left({
        errorId: LedgerErrorId.INVALID_PUBKEY,
        msg: `Could not get address from Ledger's ${chain} App`
      })
    }
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
    })
  }
}

export const verifyEVMAddress = async ({
  chain,
  transport,
  walletAccount,
  walletIndex,
  evmHDMode,
  network
}: {
  chain: Chain
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
  network: Network
}): Promise<boolean> => {
  const config = EVM_LEDGER_CHAINS[chain]
  if (!config) {
    log.error(`Unsupported chain for verification: ${chain}`)
    return false
  }

  const provider = resolveEvmProvider(config, network)

  const clientParams = {
    ...config.defaultParams,
    signer: new LedgerSigner({
      transport,
      provider,
      derivationPath: getDerivationPath(walletAccount, evmHDMode)
    }),
    rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
    network
  }

  try {
    const client = new ClientLedger(clientParams)
    await client.getAddressAsync(walletIndex, true) // Verify address on device
    return true
  } catch (error) {
    log.error(`Verification error: ${isError(error) ? error?.message : `${error}`}`)
    return false
  }
}
