import type Transport from '@ledgerhq/hw-transport'
import { FeeOption, Network, Protocol, TxHash } from '@xchainjs/xchain-client'
import { defaultEthParams } from '@xchainjs/xchain-ethereum'
import * as ETH from '@xchainjs/xchain-evm'
import { Address, AnyAsset, Asset, assetToString, baseAmount, BaseAmount, TokenAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'
import * as E from 'fp-ts/Either'

import { isEthAsset } from '../../../../renderer/helpers/assetHelper'
import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { DEPOSIT_EXPIRATION_OFFSET, ETHAddress } from '../../../../shared/ethereum/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { getBlocktime } from '../../../../shared/evm/provider'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'
import { ETH_MAINNET_ETHERS_PROVIDER, ETH_TESTNET_ETHERS_PROVIDER, createEthProviders } from './common'

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
  walletAccount,
  walletIndex,
  evmHDMode,
  apiKey
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
  apiKey: string
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const ethProviders = createEthProviders(apiKey)

    const ledgerClient = new ETH.ClientLedger({
      ...defaultEthParams,
      providers: {
        mainnet: new ethers.providers.EtherscanProvider('homestead', apiKey),
        testnet: ETH_TESTNET_ETHERS_PROVIDER,
        stagenet: ETH_MAINNET_ETHERS_PROVIDER
      },
      dataProviders: [ethProviders],
      signer: new ETH.LedgerSigner({
        transport,
        provider: new ethers.providers.EtherscanProvider('homestead', apiKey),
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network
    })

    const txHash = await ledgerClient.transfer({
      walletIndex,
      asset: asset as Asset | TokenAsset,
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
  apiKey
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
  apiKey: string
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const address = !isEthAsset(asset) ? ETH.getTokenAddress(asset as TokenAsset) : ETHAddress

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Could not get asset address from ${assetToString(asset)}`
      })
    }
    const ethProviders = createEthProviders(apiKey)

    const isETHAddress = address === ETHAddress

    const ledgerClient = new ETH.ClientLedger({
      ...defaultEthParams,
      providers: {
        mainnet: new ethers.providers.EtherscanProvider('homestead', apiKey),
        testnet: ETH_TESTNET_ETHERS_PROVIDER,
        stagenet: ETH_MAINNET_ETHERS_PROVIDER
      },
      dataProviders: [ethProviders],
      signer: new ETH.LedgerSigner({
        transport,
        provider: new ethers.providers.EtherscanProvider('homestead', apiKey),
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network
    })

    const provider = ledgerClient.getProvider()
    const gasPrices = await ledgerClient.estimateGasPrices(Protocol.THORCHAIN) // fetch gas prices from thorchain
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

    const routerContract = new ethers.Contract(router, ETH.abi.router)
    const unsignedTx = await routerContract.populateTransaction.depositWithExpiry(...depositParams)
    const nativeAsset = ledgerClient.getAssetInfo()

    const hash = await ledgerClient.transfer({
      walletIndex,
      asset: nativeAsset.asset,
      amount: isETHAddress ? amount : baseAmount(0, nativeAsset.decimal),
      memo: unsignedTx.data,
      recipient: router,
      gasPrice: gasPrices.fast,
      isMemoEncoded: true,
      gasLimit: ethers.BigNumber.from(160000)
    })

    return E.right(hash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.DEPOSIT_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}
