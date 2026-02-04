import type Transport from '@ledgerhq/hw-transport'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import * as BSC from '@xchainjs/xchain-evm'
import { Address, AnyAsset, Asset, assetToString, baseAmount, BaseAmount, TokenAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { Contract, JsonRpcProvider } from 'ethers'
import { either as E } from 'fp-ts'

import { isBscAsset } from '../../../../renderer/helpers/assetHelper'
import { DEPOSIT_EXPIRATION_OFFSET, EVMZeroAddress } from '../../../../renderer/services/evm/const'
import { GasMultiplier, LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { defaultBscParams } from '../../../../shared/bsc/const'
import { applyGasMultiplier } from '../../../../shared/evm/gas'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { getBlocktime } from '../../../../shared/evm/provider'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'

/**
 * Sends BSC tx using Ledger
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
    const isTestnet = network === Network.Testnet
    const chainId = isTestnet ? 97 : 56
    const networkName = isTestnet ? 'bnb-testnet' : 'bnb'

    // Use custom RPC URL if provided, otherwise use defaults
    const provider = evmRpcUrl
      ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
      : defaultBscParams.providers[network]

    const clientLedger = new BSC.ClientLedger({
      ...defaultBscParams,
      providers: evmRpcUrl ? { ...defaultBscParams.providers, [network]: provider } : defaultBscParams.providers,
      signer: new BSC.LedgerSigner({
        transport,
        provider,
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network
    })

    // Get gas prices and apply multiplier if configured
    const rawGasPrices = await clientLedger.estimateGasPrices()
    const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)

    const txHash = await clientLedger.transfer({
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
 * Sends BSC deposit txs using Ledger
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
    const address = !isBscAsset(asset) ? BSC.getTokenAddress(asset as TokenAsset) : EVMZeroAddress

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Could not get asset address from ${assetToString(asset)}`
      })
    }

    const isETHAddress = address === EVMZeroAddress

    // Derive chainId from the network parameter
    const isTestnet = network === Network.Testnet
    const chainId = isTestnet ? 97 : 56
    const networkName = isTestnet ? 'bnb-testnet' : 'bnb'

    // Use custom RPC URL if provided, otherwise use defaults
    const rpcProvider = evmRpcUrl
      ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
      : defaultBscParams.providers[network]

    const clientledger = new BSC.ClientLedger({
      ...defaultBscParams,
      providers: evmRpcUrl ? { ...defaultBscParams.providers, [network]: rpcProvider } : defaultBscParams.providers,
      signer: new BSC.LedgerSigner({
        transport,
        provider: rpcProvider,
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network: network
    })

    const provider = clientledger.getProvider()

    // Get gas prices and apply multiplier if configured
    const rawGasPrices = await clientledger.estimateGasPrices()
    const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)
    const gasPrice = gasPrices[feeOption].amount().toFixed(0) // no round down needed
    const blockTime = await getBlocktime(provider)
    const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET

    const depositParams = [
      recipient,
      address,
      amount.amount().toFixed(0, BigNumber.ROUND_DOWN),
      memo,
      expiration,
      isETHAddress
        ? {
            value: amount.amount().toFixed(0, BigNumber.ROUND_DOWN),
            gasPrice
          }
        : { gasPrice }
    ]

    const routerContract = new Contract(router, BSC.abi.router)
    const unsignedTx = await routerContract.getFunction('depositWithExpiry').populateTransaction(...depositParams)
    const nativeAsset = clientledger.getAssetInfo()

    const hash = await clientledger.transfer({
      walletIndex,
      asset: nativeAsset.asset,
      amount: isETHAddress ? amount : baseAmount(0, nativeAsset.decimal),
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
