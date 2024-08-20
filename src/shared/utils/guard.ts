import { FeeOption, Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetFromString, BaseAmount, Chain, isValidAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as IOG from 'io-ts/Guard'

import { EvmHDMode } from '../evm/types'
import { HDMode, WalletType } from '../wallet/types'
import { EnabledChain, isSupportedChain } from './chain'

export const nonEmptyStringGuard: IOG.Guard<unknown, string> = {
  is: (u: unknown): u is string => {
    if (typeof u === 'string' && u.length > 0) {
      return true
    }
    return false
  }
}
export const enabledChainGuard: IOG.Guard<unknown, EnabledChain> = {
  is: (u: unknown): u is EnabledChain => nonEmptyStringGuard.is(u) && isSupportedChain(u)
}

const chainGuard: IOG.Guard<unknown, Chain> = {
  is: (u: unknown): u is Chain =>
    nonEmptyStringGuard.is(u) &&
    // we do support assets of enabled chains only
    isSupportedChain(u)
}

export const isNetwork = (u: unknown): u is Network =>
  u === Network.Mainnet || u === Network.Stagenet || u === Network.Testnet

export const isFeeOption = (u: unknown): u is FeeOption =>
  u === FeeOption.Average || u === FeeOption.Fast || u === FeeOption.Fastest

export const isWalletType = (u: unknown): u is WalletType => u === 'keystore' || u === 'ledger'
export const isLedgerWallet = (walletType: WalletType): boolean => walletType === 'ledger'
export const isKeystoreWallet = (walletType: WalletType): boolean => walletType === 'keystore'

export const isEvmHDMode = (u: unknown): u is EvmHDMode => u === 'legacy' || u === 'ledgerlive' || u === 'metamask'

export const isHDMode = (u: unknown): u is HDMode => u === 'default' || isEvmHDMode(u)

const assetGuard = IOG.struct({ symbol: nonEmptyStringGuard, ticker: nonEmptyStringGuard, chain: chainGuard })

export const isAsset = (u: unknown): u is AnyAsset => {
  if (assetGuard.is(u)) return true

  if (typeof u === 'string') {
    const asset = assetFromString(u)
    if (asset) return isValidAsset(asset)
  }
  return false
}

const bnGuard: IOG.Guard<unknown, BigNumber> = {
  is: (u: unknown): u is BigNumber => BigNumber.isBigNumber(u)
}

const baseAmountGuard: IOG.Guard<unknown, BaseAmount> = {
  is: (u: unknown): u is BaseAmount => {
    if (u === null && typeof u !== 'object') return false

    return IOG.number.is((u as BaseAmount)?.decimal) && bnGuard.is((u as BaseAmount)?.amount())
  }
}

export const isBaseAmount = (u: unknown): u is BaseAmount => baseAmountGuard.is(u)

export const isError = (u: unknown): u is Error => u instanceof Error
