import type Transport from '@ledgerhq/hw-transport'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import { abi, getTokenAddress } from '@xchainjs/xchain-evm'
import {
  Address,
  AnyAsset,
  Asset,
  assetToString,
  baseAmount,
  BaseAmount,
  getContractAddressFromAsset,
  TokenAsset
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { Contract, getAddress, ZeroAddress } from 'ethers'
import { either as E } from 'fp-ts'

import { isEVMTokenAsset } from '../../../../renderer/helpers/assetHelper'
import { EVMZeroAddress } from '../../../../renderer/services/evm/const'
import { GasMultiplier, LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { applyGasMultiplier } from '../../../../shared/evm/gas'
import { getBlocktime } from '../../../../shared/evm/provider'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { DEPOSIT_EXPIRATION_OFFSET, LedgerEvmChainConfig, createLedgerEvmClient, resolveEvmProvider } from './common'

/**
 * Sends an EVM transaction using Ledger.
 * Works for all EVM chains (ETH, ARB, AVAX, BSC, BASE).
 */
export const evmSend = async ({
  config,
  asset,
  transport,
  network,
  amount,
  memo,
  recipient,
  feeOption,
  walletAccount,
  walletIndex,
  evmHDMode,
  apiKey,
  evmRpcUrl,
  gasMultiplier = 1
}: {
  config: LedgerEvmChainConfig
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
  apiKey?: string
  evmRpcUrl?: string
  gasMultiplier?: GasMultiplier
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const provider = resolveEvmProvider(config, network, evmRpcUrl)
    const ledgerClient = createLedgerEvmClient({
      config,
      transport,
      network,
      walletAccount,
      evmHDMode,
      provider,
      evmRpcUrl,
      apiKey
    })

    const rawGasPrices = await ledgerClient.estimateGasPrices()
    const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)

    const txHash = await ledgerClient.transfer({
      walletIndex,
      asset: asset as Asset | TokenAsset,
      recipient,
      amount,
      memo,
      gasPrice: gasPrices[feeOption]
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
      msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
    })
  }
}

/**
 * Sends an EVM deposit transaction using Ledger.
 * Works for all EVM chains (ETH, ARB, AVAX, BSC, BASE).
 *
 * Two deposit patterns based on config flags:
 * - ETH/ARB/BSC: getTokenAddress + tx options in depositParams
 * - AVAX/BASE: checksummed contract address, flat depositParams
 */
export const evmDeposit = async ({
  config,
  asset,
  transport,
  router,
  network,
  amount,
  memo,
  recipient,
  walletAccount,
  walletIndex,
  feeOption,
  evmHDMode,
  apiKey,
  evmRpcUrl,
  gasMultiplier = 1
}: {
  config: LedgerEvmChainConfig
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
  apiKey?: string
  evmRpcUrl?: string
  gasMultiplier?: GasMultiplier
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    // Resolve token address and native asset flag based on chain type
    let tokenAddress: string | null
    let isNativeAsset: boolean

    if (config.useChecksummedContractAddress) {
      // AVAX/BASE: use checksummed contract address
      const isERC20 = isEVMTokenAsset(asset as TokenAsset)
      tokenAddress = isERC20 ? getAddress(getContractAddressFromAsset(asset as TokenAsset)) : ZeroAddress
      isNativeAsset = !isERC20
    } else {
      // ETH/ARB/BSC: use getTokenAddress with chain asset check
      tokenAddress = !config.isChainAsset(asset) ? getTokenAddress(asset as TokenAsset) : EVMZeroAddress
      isNativeAsset = tokenAddress === EVMZeroAddress
    }

    if (!tokenAddress) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Could not get asset address from ${assetToString(asset)}`
      })
    }

    const provider = resolveEvmProvider(config, network, evmRpcUrl, { forDeposit: true, apiKey })
    const ledgerClient = createLedgerEvmClient({
      config,
      transport,
      network,
      walletAccount,
      evmHDMode,
      provider,
      evmRpcUrl,
      apiKey
    })

    const clientProvider = ledgerClient.getProvider()
    const rawGasPrices = await ledgerClient.estimateGasPrices(config.depositProtocol)
    const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)
    const blockTime = await getBlocktime(clientProvider)
    const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET

    // Build deposit params based on chain type
    let depositParams: unknown[]
    if (config.includeDepositTxOptions) {
      // ETH/ARB/BSC: include tx options (value + gasPrice) in deposit params
      const gasPrice = gasPrices[feeOption].amount().toFixed(0)
      depositParams = [
        recipient,
        tokenAddress,
        amount.amount().toFixed(0, BigNumber.ROUND_DOWN),
        memo,
        expiration,
        isNativeAsset ? { value: amount.amount().toFixed(0, BigNumber.ROUND_DOWN), gasPrice } : { gasPrice }
      ]
    } else {
      // AVAX/BASE: flat params without tx options
      depositParams = [recipient, tokenAddress, amount.amount().toFixed(), memo, expiration]
    }

    const routerContract = new Contract(router, abi.router)
    const unsignedTx = await routerContract.getFunction('depositWithExpiry').populateTransaction(...depositParams)
    const nativeAsset = ledgerClient.getAssetInfo()

    const hash = await ledgerClient.transfer({
      walletIndex,
      asset: nativeAsset.asset,
      amount: isNativeAsset ? amount : baseAmount(0, nativeAsset.decimal),
      memo: unsignedTx.data,
      recipient: router,
      gasPrice: gasPrices[feeOption],
      isMemoEncoded: true,
      gasLimit: new BigNumber(config.depositGasLimit)
    })

    return E.right(hash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.DEPOSIT_TX_FAILED,
      msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
    })
  }
}
