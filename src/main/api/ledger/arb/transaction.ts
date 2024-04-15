import EthApp from '@ledgerhq/hw-app-eth'
import type Transport from '@ledgerhq/hw-transport'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import * as ARB from '@xchainjs/xchain-evm'
import { Address, Asset, assetToString, BaseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as E from 'fp-ts/Either'

import { isAethAsset } from '../../../../renderer/helpers/assetHelper'
import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { DEPOSIT_EXPIRATION_OFFSET, ArbZeroAddress, FEE_BOUNDS, defaultArbParams } from '../../../../shared/arb/const'
import { ROUTER_ABI } from '../../../../shared/evm/abi'
import { getDerivationPath } from '../../../../shared/evm/ledger'
import { getBlocktime } from '../../../../shared/evm/provider'
import { EvmHDMode } from '../../../../shared/evm/types'
import { toClientNetwork } from '../../../../shared/utils/client'
import { isError } from '../../../../shared/utils/guard'
import { LedgerSigner } from '../ethereum/LedgerSigner'
/**
 * Sends ETH tx using Ledger
 */
export const send = async ({
  asset,
  transport,
  network,
  amount,
  memo,
  recipient,
  feeOption,
  walletIndex,
  evmHDMode
}: {
  asset: Asset
  transport: Transport
  amount: BaseAmount
  network: string
  recipient: Address
  memo?: string
  feeOption: FeeOption
  walletIndex: number
  evmHDMode: EvmHDMode
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const clientNetwork = toClientNetwork(network)

    const client = new ARB.Client({
      ...defaultArbParams,
      network: clientNetwork,
      feeBounds: FEE_BOUNDS[clientNetwork]
    })

    const app = new EthApp(transport)
    const path = getDerivationPath(walletIndex, evmHDMode)
    const provider = client.getProvider()
    const signer = new LedgerSigner({ provider, path, app })

    const txHash = await client.transfer({
      signer,
      asset,
      memo,
      amount,
      recipient,
      feeOption
    })

    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Could not get transaction hash to send ${asset.symbol} transaction`
      })
    }

    return E.right(txHash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}

/**
 * Sends ETH deposit txs using Ledger
 */
export const deposit = async ({
  transport,
  asset,
  router,
  network,
  amount,
  memo,
  recipient,
  walletIndex,
  feeOption,
  evmHDMode
}: {
  asset: Asset
  router: Address
  transport: Transport
  amount: BaseAmount
  network: Network
  recipient: Address
  memo?: string
  walletIndex: number
  feeOption: FeeOption
  evmHDMode: EvmHDMode
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const address = !isAethAsset(asset) ? ARB.getTokenAddress(asset) : ArbZeroAddress

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Could not get asset address from ${assetToString(asset)}`
      })
    }

    const isETHAddress = address === ArbZeroAddress

    const clientNetwork = toClientNetwork(network)

    const client = new ARB.Client({
      ...defaultArbParams,
      network: clientNetwork,
      feeBounds: FEE_BOUNDS[clientNetwork]
    })

    const app = new EthApp(transport)
    const path = getDerivationPath(walletIndex, evmHDMode)
    const provider = client.getProvider()
    const signer = new LedgerSigner({ provider, path, app })

    const gasPrices = await client.estimateGasPrices()
    const gasPrice = gasPrices[feeOption].amount().toFixed(0) // no round down needed
    const blockTime = await getBlocktime(provider)
    const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET

    // Note: `client.call` handling very - similar to `runSendPoolTx$` in `src/renderer/services/ethereum/transaction.ts`
    // Call deposit function of Router contract
    // Note2: Amounts need to use `toFixed` to convert `BaseAmount` to `Bignumber`
    // since `value` and `gasPrice` type is `Bignumber`
    const { hash } = await client.call<{ hash: TxHash }>({
      signer,
      contractAddress: router,
      abi: ROUTER_ABI,
      funcName: 'depositWithExpiry',
      funcParams: [
        recipient,
        address,
        // Send `BaseAmount` w/o decimal and always round down for currencies
        amount.amount().toFixed(0, BigNumber.ROUND_DOWN),
        memo,
        expiration,
        isETHAddress
          ? {
              // Send `BaseAmount` w/o decimal and always round down for currencies
              value: amount.amount().toFixed(0, BigNumber.ROUND_DOWN),
              gasPrice
            }
          : { gasPrice }
      ]
    })

    return E.right(hash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.DEPOSIT_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}
