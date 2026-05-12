import type Transport from '@ledgerhq/hw-transport'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { AddressFormat, BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { TRONChain } from '@xchainjs/xchain-tron'
import { Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { either as E } from 'fp-ts'

import { IPCLedgerAddressParams, LedgerError, LedgerErrorId } from '../../../shared/api/types'
import { LEDGER_TRANSPORT_TIMEOUT_MS } from '../../../shared/const'
import { isSupportedChain } from '../../../shared/utils/chain'
import { isError, isEvmHDMode } from '../../../shared/utils/guard'
import { HDMode, WalletAddress } from '../../../shared/wallet/types'
import { getAddress as getBTCAddress, verifyAddress as verifyBTCAddress } from './bitcoin/address'
import { getAddress as getBCHAddress, verifyAddress as verifyBCHAddress } from './bitcoincash/address'
import { getAddress as getCOSMOSAddress, verifyAddress as verifyCOSMOSAddress } from './cosmos/address'
import { getAddress as getDASHAddress, verifyAddress as verifyDASHAddress } from './dash/address'
import { getAddress as getDOGEAddress, verifyAddress as verifyDOGEAddress } from './doge/address'
import { getEVMAddress, verifyEVMAddress } from './evm/address'
import { getAddress as getLTCAddress, verifyAddress as verifyLTCAddress } from './litecoin/address'
import { getAddress as getMAYAAddress, verifyAddress as verifyMAYAAddress } from './mayachain/address'
import { getAddress as getXRPAddress, verifyAddress as verifyXRPAddress } from './ripple/address'
import { getAddress as getSOLAddress, verifyAddress as verifySOLAddress } from './solana/address'
import { getAddress as getTHORAddress, verifyAddress as verifyTHORAddress } from './thorchain/address'
import { getAddress as getTRONAddress, verifyAddress as verifyTRONAddress } from './tron/address'

const TransportNodeHidSingleton = require('@ledgerhq/hw-transport-node-hid-singleton')

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ])

const handleEVMChain = (
  chain: Chain,
  transport: Transport,
  network: Network,
  walletAccount: number,
  walletIndex: number,
  hdMode?: HDMode,
  errorMsg = 'Invalid HD mode for EVM chain'
) => {
  if (!isEvmHDMode(hdMode)) {
    return Promise.resolve(
      E.left({
        errorId: LedgerErrorId.INVALID_ETH_DERIVATION_MODE,
        msg: errorMsg
      })
    )
  }
  return getEVMAddress({ chain, transport, walletAccount, walletIndex, evmHDMode: hdMode, network })
}

const chainAddressFunctions: Record<
  Chain,
  (
    transport: Transport,
    network: Network,
    walletAccount: number,
    walletIndex: number,
    hdMode?: HDMode,
    addressFormat?: AddressFormat
  ) => Promise<E.Either<LedgerError, WalletAddress>>
> = {
  [ETHChain]: (transport, network, walletAccount, walletIndex, hdMode) =>
    handleEVMChain(ETHChain, transport, network, walletAccount, walletIndex, hdMode, 'Invalid ETH HD mode'),
  [AVAXChain]: (transport, network, walletAccount, walletIndex, hdMode) =>
    handleEVMChain(AVAXChain, transport, network, walletAccount, walletIndex, hdMode, 'Invalid AVAX HD mode'),
  [BSCChain]: (transport, network, walletAccount, walletIndex, hdMode) =>
    handleEVMChain(BSCChain, transport, network, walletAccount, walletIndex, hdMode, 'Invalid BSC HD mode'),
  [ARBChain]: (transport, network, walletAccount, walletIndex, hdMode) =>
    handleEVMChain(ARBChain, transport, network, walletAccount, walletIndex, hdMode, 'Invalid ARB HD mode'),
  [BASEChain]: (transport, network, walletAccount, walletIndex, hdMode) =>
    handleEVMChain(BASEChain, transport, network, walletAccount, walletIndex, hdMode, 'Invalid BASE HD mode'),

  // Non-EVM chains
  [THORChain]: getTHORAddress,
  [MAYAChain]: getMAYAAddress,
  [BTCChain]: getBTCAddress,
  [LTCChain]: getLTCAddress,
  [BCHChain]: getBCHAddress,
  [DOGEChain]: getDOGEAddress,
  [DASHChain]: getDASHAddress,
  [GAIAChain]: getCOSMOSAddress,
  [XRPChain]: getXRPAddress,
  [SOLChain]: getSOLAddress,
  [TRONChain]: getTRONAddress
}

const unsupportedChains: Chain[] = [KUJIChain, RadixChain, ZECChain, 'ADA']

export const getAddress = async ({
  chain,
  network,
  walletAccount,
  walletIndex,
  hdMode
}: IPCLedgerAddressParams): Promise<E.Either<LedgerError, WalletAddress>> => {
  // Validate chain before opening the device — no point connecting for an unsupported chain
  if (!isSupportedChain(chain) || unsupportedChains.includes(chain)) {
    return E.left({
      errorId: LedgerErrorId.NOT_IMPLEMENTED,
      msg: `${chain} is not supported for 'getAddress'`
    })
  }

  const addressFunction = chainAddressFunctions[chain]
  if (!addressFunction) {
    return E.left({
      errorId: LedgerErrorId.NOT_IMPLEMENTED,
      msg: `${chain} is not supported for 'getAddress'`
    })
  }

  let transport: Transport | null = null
  try {
    const t: Transport = await withTimeout(
      TransportNodeHidSingleton.default.create(),
      LEDGER_TRANSPORT_TIMEOUT_MS,
      'Ledger transport'
    )
    transport = t
    return await addressFunction(t, network, walletAccount, walletIndex, hdMode)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
    })
  } finally {
    if (transport) {
      try {
        await transport.close()
      } catch {
        // Swallow close errors — don't mask the real result with a cleanup failure
      }
    }
  }
}

export const verifyLedgerAddress = async ({
  chain,
  network,
  walletAccount,
  walletIndex,
  hdMode
}: IPCLedgerAddressParams) => {
  if (!isSupportedChain(chain)) throw Error(`${chain} is not supported for 'verifyAddress'`)

  let transport: Transport | null = null
  let result = false
  try {
    const t: Transport = await withTimeout(
      TransportNodeHidSingleton.default.create(),
      LEDGER_TRANSPORT_TIMEOUT_MS,
      'Ledger transport'
    )
    transport = t
    switch (chain) {
      case THORChain:
        result = await verifyTHORAddress({ transport: t, network, walletAccount, walletIndex })
        break
      case MAYAChain:
        result = await verifyMAYAAddress({ transport: t, network, walletAccount, walletIndex })
        break
      case BTCChain:
        result = await verifyBTCAddress({ transport: t, network, walletAccount, walletIndex, hdMode })
        break
      case LTCChain:
        result = await verifyLTCAddress({ transport: t, network, walletAccount, walletIndex })
        break
      case BCHChain:
        result = await verifyBCHAddress({ transport: t, network, walletAccount, walletIndex })
        break
      case DOGEChain:
        result = await verifyDOGEAddress({ transport: t, network, walletAccount, walletIndex })
        break
      case DASHChain:
        result = await verifyDASHAddress({ transport: t, network, walletAccount, walletIndex })
        break
      case ETHChain:
      case AVAXChain:
      case BASEChain:
      case BSCChain:
      case ARBChain: {
        if (!isEvmHDMode(hdMode)) throw Error(`Invalid 'EvmHDMode' - needed for ${chain} to verify Ledger address`)
        result = await verifyEVMAddress({
          chain,
          transport: t,
          walletAccount,
          walletIndex,
          evmHDMode: hdMode,
          network
        })
        break
      }
      case GAIAChain:
        result = await verifyCOSMOSAddress(t, walletAccount, walletIndex, network)
        break
      case XRPChain:
        result = await verifyXRPAddress(t, walletAccount, walletIndex, network)
        break
      case SOLChain:
        result = await verifySOLAddress({ transport: t, network, walletAccount, walletIndex })
        break
      case TRONChain:
        result = await verifyTRONAddress({ transport: t, network, walletAccount, walletIndex })
        break
    }
  } finally {
    if (transport) {
      try {
        await transport.close()
      } catch {
        // Swallow close errors
      }
    }
  }

  return result
}
