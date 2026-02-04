import type Transport from '@ledgerhq/hw-transport'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import { ClientLedger, LedgerSigner, abi, getTokenAddress } from '@xchainjs/xchain-evm'
import {
  Address,
  AnyAsset,
  Asset,
  assetToString,
  BaseAmount,
  getContractAddressFromAsset,
  baseAmount,
  TokenAsset
} from '@xchainjs/xchain-util'
import { BigNumber } from 'bignumber.js'
import { Contract, getAddress, JsonRpcProvider, ZeroAddress } from 'ethers'
import { either as E } from 'fp-ts'

import { isBaseAsset, isEVMTokenAsset } from '../../../../renderer/helpers/assetHelper'
import { DEPOSIT_EXPIRATION_OFFSET, EVMZeroAddress } from '../../../../renderer/services/evm/const'
import { GasMultiplier, LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultBaseParams } from '../../../../shared/base/const'
import { applyGasMultiplier } from '../../../../shared/evm/gas'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { getBlocktime } from '../../../../shared/evm/provider'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'

/**
 * Sends BASE tx using Ledger
 */
export const send = async ({
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
  evmRpcUrl,
  gasMultiplier = 1
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
  evmRpcUrl?: string
  gasMultiplier?: GasMultiplier
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    // Derive chainId from the network parameter
    // Base mainnet: 8453, Base Sepolia testnet: 84532
    const isTestnet = network === Network.Testnet
    const chainId = isTestnet ? 84532 : 8453
    const networkName = isTestnet ? 'base-sepolia' : 'base'

    // Use custom RPC URL if provided, otherwise use defaults
    const provider = evmRpcUrl
      ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
      : defaultBaseParams.providers[network]

    const ledgerClient = new ClientLedger({
      ...defaultBaseParams,
      providers: evmRpcUrl ? { ...defaultBaseParams.providers, [network]: provider } : defaultBaseParams.providers,
      signer: new LedgerSigner({
        transport,
        provider,
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network: network
    })

    // Get gas prices and apply multiplier if configured
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
 * Sends BASE deposit txs using Ledger
 */
export const deposit = async ({
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
  evmRpcUrl,
  gasMultiplier = 1
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
  evmRpcUrl?: string
  gasMultiplier?: GasMultiplier
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const address = !isBaseAsset(asset) ? getTokenAddress(asset as TokenAsset) : EVMZeroAddress

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Could not get asset address from ${assetToString(asset)}`
      })
    }

    // Derive chainId from the network parameter
    // Base mainnet: 8453, Base Sepolia testnet: 84532
    const isTestnet = network === Network.Testnet
    const chainId = isTestnet ? 84532 : 8453
    const networkName = isTestnet ? 'base-sepolia' : 'base'

    // Use custom RPC URL if provided, otherwise use defaults
    const rpcProvider = evmRpcUrl
      ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
      : defaultBaseParams.providers[network]

    const ledgerClient = new ClientLedger({
      ...defaultBaseParams,
      providers: evmRpcUrl ? { ...defaultBaseParams.providers, [network]: rpcProvider } : defaultBaseParams.providers,
      signer: new LedgerSigner({
        transport,
        provider: rpcProvider,
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network: network
    })

    const isERC20 = isEVMTokenAsset(asset as TokenAsset)
    const checkSummedContractAddress = isERC20
      ? getAddress(getContractAddressFromAsset(asset as TokenAsset))
      : ZeroAddress
    const provider = ledgerClient.getProvider()
    const blockTime = await getBlocktime(provider)
    const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET
    const depositParams = [recipient, checkSummedContractAddress, amount.amount().toFixed(), memo, expiration]

    const routerContract = new Contract(router, abi.router)
    const nativeAsset = ledgerClient.getAssetInfo()

    // Get gas prices and apply multiplier if configured
    const rawGasPrices = await ledgerClient.estimateGasPrices()
    const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)

    const unsignedTx = await routerContract.getFunction('depositWithExpiry').populateTransaction(...depositParams)

    const hash = await ledgerClient.transfer({
      walletIndex,
      asset: nativeAsset.asset,
      amount: isERC20 ? baseAmount(0, nativeAsset.decimal) : amount,
      memo: unsignedTx.data,
      recipient: router,
      gasPrice: gasPrices[feeOption],
      isMemoEncoded: true,
      gasLimit: new BigNumber(160000)
    })
    return E.right(hash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.DEPOSIT_TX_FAILED,
      msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
    })
  }
}
