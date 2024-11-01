import type Transport from '@ledgerhq/hw-transport'
import { ARBChain, defaultArbParams } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain, defaultBaseParams } from '@xchainjs/xchain-base'
import { BSCChain, defaultBscParams } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain, defaultEthParams } from '@xchainjs/xchain-ethereum'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import { Chain } from '@xchainjs/xchain-util'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'

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
  let clientParams

  switch (chain) {
    case ETHChain:
      clientParams = {
        ...defaultEthParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultEthParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case ARBChain:
      clientParams = {
        ...defaultArbParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultArbParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case AVAXChain:
      clientParams = {
        ...defaultAvaxParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultAvaxParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case BSCChain:
      clientParams = {
        ...defaultBscParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultBscParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case BASEChain:
      clientParams = {
        ...defaultBaseParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultBaseParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    default:
      throw new Error(`Unsupported chain: ${chain}`)
  }
  try {
    const client = new ClientLedger(clientParams)
    const address = await client.getAddressAsync(walletIndex)

    if (address) {
      return E.right({ address, chain: chain, type: 'ledger', walletAccount, walletIndex, hdMode: evmHDMode })
    } else {
      return E.left({
        errorId: LedgerErrorId.INVALID_PUBKEY,
        msg: `Could not get address from Ledger's ${chain} App`
      })
    }
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
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
  let clientParams
  switch (chain) {
    case ETHChain:
      clientParams = {
        ...defaultEthParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultEthParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case ARBChain:
      clientParams = {
        ...defaultArbParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultArbParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case AVAXChain:
      clientParams = {
        ...defaultAvaxParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultAvaxParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case BSCChain:
      clientParams = {
        ...defaultBscParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultBscParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    case BASEChain:
      clientParams = {
        ...defaultBaseParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultBaseParams.providers[Network.Mainnet],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    default:
      console.error(`Unsupported chain for verification: ${chain}`)
      return false
  }

  try {
    const client = new ClientLedger(clientParams)
    await client.getAddressAsync(walletIndex, true) // Verify address on device
    return true
  } catch (error) {
    console.error(`Verification error: ${isError(error) ? error?.message : `${error}`}`)
    return false
  }
}
