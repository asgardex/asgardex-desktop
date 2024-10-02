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
import { ethers } from 'ethers'
import * as E from 'fp-ts/Either'

import { isAvaxAsset, isAvaxTokenAsset } from '../../../../renderer/helpers/assetHelper'
import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { DEPOSIT_EXPIRATION_OFFSET, AvaxZeroAddress, defaultAvaxParams } from '../../../../shared/avax/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { getBlocktime } from '../../../../shared/evm/provider'
import { EvmHDMode } from '../../../../shared/evm/types'
import { isError } from '../../../../shared/utils/guard'

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
    const ledgerClient = new ClientLedger({
      ...defaultAvaxParams,
      signer: new LedgerSigner({
        transport,
        provider: defaultAvaxParams.providers[Network.Mainnet],
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network: network
    })
    const txHash = await ledgerClient.transfer({
      walletIndex,
      asset: asset as Asset | TokenAsset,
      recipient,
      amount,
      memo,
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
 * Sends Avax deposit txs using Ledger
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
    const address = !isAvaxAsset(asset) ? getTokenAddress(asset as TokenAsset) : AvaxZeroAddress

    if (!address) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Could not get asset address from ${assetToString(asset)}`
      })
    }

    const ledgerClient = new ClientLedger({
      ...defaultAvaxParams,
      signer: new LedgerSigner({
        transport,
        provider: defaultAvaxParams.providers[Network.Mainnet],
        derivationPath: getDerivationPath(walletAccount, evmHDMode)
      }),
      rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
      network: network
    })

    const isERC20 = isAvaxTokenAsset(asset as TokenAsset)
    const checkSummedContractAddress = isERC20
      ? ethers.utils.getAddress(getContractAddressFromAsset(asset as TokenAsset))
      : ethers.constants.AddressZero
    const provider = ledgerClient.getProvider()
    const blockTime = await getBlocktime(provider)
    const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET
    const depositParams = [recipient, checkSummedContractAddress, amount.amount().toFixed(), memo, expiration]

    const routerContract = new ethers.Contract(router, abi.router)
    const nativeAsset = ledgerClient.getAssetInfo()

    const gasPrices = await ledgerClient.estimateGasPrices()

    const unsignedTx = await routerContract.populateTransaction.depositWithExpiry(...depositParams)

    const hash = await ledgerClient.transfer({
      walletIndex,
      asset: nativeAsset.asset,
      amount: isERC20 ? baseAmount(0, nativeAsset.decimal) : amount,
      memo: unsignedTx.data,
      recipient: router,
      gasPrice: gasPrices[feeOption],
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
