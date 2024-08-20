import type Transport from '@ledgerhq/hw-transport'
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid-singleton'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import * as BSC from '@xchainjs/xchain-evm'
import { Address, AnyAsset, assetToString, BaseAmount, TokenAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as E from 'fp-ts/Either'

import { isBscAsset } from '../../../../renderer/helpers/assetHelper'
import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { DEPOSIT_EXPIRATION_OFFSET, BscZeroAddress, defaultBscParams } from '../../../../shared/bsc/const'
import { ROUTER_ABI } from '../../../../shared/evm/abi'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { getBlocktime } from '../../../../shared/evm/provider'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'

/**
 * Sends BSC tx using Ledger
 */
export const send = async ({
  asset,
  network,
  amount,
  memo,
  recipient,
  feeOption,
  walletAccount,
  walletIndex,
  evmHDMode
}: {
  asset: AnyAsset
  transport: Transport
  amount: BaseAmount
  network: Network
  recipient: Address
  memo?: string
  feeOption: FeeOption
  walletAccount: number
  walletIndex: number
  evmHDMode: EvmHDMode
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const clientledger = new BSC.ClientLedger({
      ...defaultBscParams,
      signer: new BSC.LedgerSigner({
        transport: await TransportNodeHid.create(),
        provider: defaultBscParams.providers[Network.Mainnet],
        derivationPath: getDerivationPath(walletAccount, walletIndex, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, evmHDMode),
      network: network
    })
    const bscAsset = asset as BSC.CompatibleAsset
    const txHash = await clientledger.transfer({ walletIndex, asset: bscAsset, recipient, amount, memo, feeOption })

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
 * Sends BSC deposit txs using Ledger
 */
export const deposit = async ({
  asset,
  router,
  network,
  amount,
  memo,
  recipient,
  walletAccount,
  walletIndex,
  feeOption,
  evmHDMode
}: {
  asset: AnyAsset
  router: Address
  transport: Transport
  amount: BaseAmount
  network: Network
  recipient: Address
  memo?: string
  walletAccount: number
  walletIndex: number
  feeOption: FeeOption
  evmHDMode: EvmHDMode
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const address = !isBscAsset(asset) ? BSC.getTokenAddress(asset as TokenAsset) : BscZeroAddress

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Could not get asset address from ${assetToString(asset)}`
      })
    }

    const isETHAddress = address === BscZeroAddress

    const clientledger = new BSC.ClientLedger({
      ...defaultBscParams,
      signer: new BSC.LedgerSigner({
        transport: await TransportNodeHid.create(),
        provider: defaultBscParams.providers[Network.Mainnet],
        derivationPath: getDerivationPath(walletAccount, walletIndex, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, evmHDMode),
      network: network
    })

    const provider = clientledger.getProvider()

    const gasPrices = await clientledger.estimateGasPrices()
    const gasPrice = gasPrices[feeOption].amount().toFixed(0) // no round down needed
    const blockTime = await getBlocktime(provider)
    const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET

    // Note: `client.call` handling very - similar to `runSendPoolTx$` in `src/renderer/services/ethereum/transaction.ts`
    // Call deposit function of Router contract
    // Note2: Amounts need to use `toFixed` to convert `BaseAmount` to `Bignumber`
    // since `value` and `gasPrice` type is `Bignumber`
    const { hash } = await clientledger.call<{ hash: TxHash }>({
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
