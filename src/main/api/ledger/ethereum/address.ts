import type Transport from '@ledgerhq/hw-transport'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { ClientLedger } from '@xchainjs/xchain-evm'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultEthParams } from '../../../../shared/ethereum/const'
import { getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'

export const getAddress = async ({
  walletIndex,
  evmHDMode
}: {
  transport: Transport
  walletIndex: number
  evmHDMode: EvmHDMode
}): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const clientLedger = new ClientLedger({
      ...defaultEthParams,
      rootDerivationPaths: getDerivationPaths(walletIndex, evmHDMode)
    })
    const address = await clientLedger.getAddressAsync(walletIndex)
    if (address) {
      return E.right({ address, chain: ETHChain, type: 'ledger', walletIndex, hdMode: evmHDMode })
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
  walletIndex,
  evmHDMode
}: {
  transport: Transport
  walletIndex: number
  evmHDMode: EvmHDMode
}) => {
  const clientLedger = new ClientLedger({
    ...defaultEthParams,
    rootDerivationPaths: getDerivationPaths(walletIndex, evmHDMode)
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
