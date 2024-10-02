import type Transport from '@ledgerhq/hw-transport'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { ClientLedger } from '@xchainjs/xchain-evm'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultArbParams } from '../../../../shared/arb/const'
import { getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'

export const getAddress = async ({
  walletAccount,
  walletIndex,
  evmHdMode
}: {
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHdMode: EvmHDMode
}): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const clientLedger = new ClientLedger({
      ...defaultArbParams,
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHdMode)
    })
    const address = await clientLedger.getAddressAsync(walletIndex)

    if (address) {
      return E.right({ address, chain: ARBChain, type: 'ledger', walletAccount, walletIndex, hdMode: evmHdMode })
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
  evmHdMode
}: {
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHdMode: EvmHDMode
}) => {
  const clientLedger = new ClientLedger({
    ...defaultArbParams,
    rootDerivationPaths: getDerivationPaths(walletAccount, evmHdMode)
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
