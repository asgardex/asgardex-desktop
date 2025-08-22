import type Transport from '@ledgerhq/hw-transport'
import { ARBChain, defaultArbParams } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain, defaultBaseParams } from '@xchainjs/xchain-base'
import { BSCChain, defaultBscParams } from '@xchainjs/xchain-bsc'
import { Network, Protocol } from '@xchainjs/xchain-client'
import { ETHChain, defaultEthParams } from '@xchainjs/xchain-ethereum'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import { Asset, BaseAmount, Chain } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'

export const getEVMFeesFromLedger = async ({
  chain,
  transport,
  walletAccount,
  walletIndex,
  evmHDMode,
  network,
  asset,
  amount,
  recipient,
  from
}: {
  chain: Chain
  transport: Transport
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
  network: Network
  asset: Asset
  amount: BaseAmount
  recipient: string
  from: string
}): Promise<E.Either<LedgerError, { fast: BaseAmount; fastest: BaseAmount; average: BaseAmount }>> => {
  let clientParams

  switch (chain) {
    case ETHChain:
      clientParams = {
        ...defaultEthParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultEthParams.providers[network],
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
          provider: defaultArbParams.providers[network],
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
          provider: defaultAvaxParams.providers[network],
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
          provider: defaultBscParams.providers[network],
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
          provider: defaultBaseParams.providers[network],
          derivationPath: getDerivationPath(walletAccount, evmHDMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
        network: network
      }
      break
    default:
      return E.left({
        errorId: LedgerErrorId.GET_ADDRESS_FAILED,
        msg: `Unsupported chain: ${chain}`
      })
  }

  try {
    const client = new ClientLedger(clientParams)

    // Estimate gas prices
    const gasPrices = await client.estimateGasPrices(Protocol.THORCHAIN)
    const { fast: fastGP, fastest: fastestGP, average: averageGP } = gasPrices

    // Estimate gas limit
    const gasLimit = await client.estimateGasLimit({
      from,
      asset,
      amount,
      recipient
    })

    // Calculate fees for each speed
    const fastFee = fastGP.times(gasLimit)
    const fastestFee = fastestGP.times(gasLimit)
    const averageFee = averageGP.times(gasLimit)

    return E.right({
      fast: fastFee,
      fastest: fastestFee,
      average: averageFee
    })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}
