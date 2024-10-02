import type Transport from '@ledgerhq/hw-transport'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { Network } from '@xchainjs/xchain-client'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'

export const getAddress = async ({
  transport,
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
      ...defaultAvaxParams,
      signer: new LedgerSigner({
        transport,
        provider: defaultAvaxParams.providers[Network.Mainnet],
        derivationPath: getDerivationPath(walletAccount, evmHdMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHdMode)
    })
    const address = await clientLedger.getAddressAsync(walletIndex)

    if (address) {
      return E.right({ address, chain: AVAXChain, type: 'ledger', walletAccount, walletIndex, hdMode: evmHdMode })
    } else {
      return E.left({
        errorId: LedgerErrorId.INVALID_PUBKEY,
        msg: `Could not get address from Ledger's Avax App`
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
  evmHdMode
}: {
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHdMode: EvmHDMode
}) => {
  const clientLedger = new ClientLedger({
    ...defaultAvaxParams,
    signer: new LedgerSigner({
      transport,
      provider: defaultAvaxParams.providers[Network.Mainnet],
      derivationPath: getDerivationPath(walletAccount, evmHdMode)
    }),
    rootDerivationPaths: getDerivationPaths(walletAccount, evmHdMode)
  })
  const _ = await clientLedger.getAddressAsync(walletIndex, true)
  return true
}
