import type Transport from '@ledgerhq/hw-transport'
import type { AddressFormat } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'

import { IPCLedgerAddressParams, LedgerError, LedgerErrorId } from '../../../shared/api/types'
import { LEDGER_TRANSPORT_TIMEOUT_MS } from '../../../shared/const'
import { isSupportedChain } from '../../../shared/utils/chain'
import {
  ARBChain,
  AVAXChain,
  BASEChain,
  BCHChain,
  BSCChain,
  BTCChain,
  DASHChain,
  DOGEChain,
  ETHChain,
  GAIAChain,
  LTCChain,
  MAYAChain,
  RadixChain,
  SOLChain,
  THORChain,
  TRONChain,
  XRPChain,
  ZECChain
} from '../../../shared/utils/chainIds'
import { isError, isEvmHDMode } from '../../../shared/utils/guard'
import { HDMode, WalletAddress } from '../../../shared/wallet/types'

const TransportNodeHidSingleton = require('@ledgerhq/hw-transport-node-hid-singleton')

/** Identifiable timeout error so callers can distinguish a transport timeout from other failures. */
class TransportTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransportTimeoutError'
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TransportTimeoutError(`${label} timed out after ${ms}ms`)), ms)
  })
  // Clear the timer whichever promise wins, so a successful call doesn't leave
  // a dangling timer in the main process.
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

const handleEVMChain = async (
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
  const { getEVMAddress } = await import('./evm/address')
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

  // Non-EVM chains. Each client loads only when that chain is asked for.
  [THORChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./thorchain/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [MAYAChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./mayachain/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [BTCChain]: async (transport, network, walletAccount, walletIndex, hdMode, addressFormat) => {
    const { getAddress } = await import('./bitcoin/address')
    return getAddress(transport, network, walletAccount, walletIndex, hdMode, addressFormat)
  },
  [LTCChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./litecoin/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [BCHChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./bitcoincash/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [DOGEChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./doge/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [DASHChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./dash/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [GAIAChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./cosmos/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [XRPChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./ripple/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [SOLChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./solana/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  },
  [TRONChain]: async (transport, network, walletAccount, walletIndex) => {
    const { getAddress } = await import('./tron/address')
    return getAddress(transport, network, walletAccount, walletIndex)
  }
}

const unsupportedChains: Chain[] = [RadixChain, ZECChain, 'ADA']

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
      errorId: error instanceof TransportTimeoutError ? LedgerErrorId.TIMEOUT : LedgerErrorId.GET_ADDRESS_FAILED,
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
  if (!isSupportedChain(chain) || unsupportedChains.includes(chain)) {
    throw Error(`${chain} is not supported for 'verifyAddress'`)
  }

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
      case THORChain: {
        const { verifyAddress } = await import('./thorchain/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
      case MAYAChain: {
        const { verifyAddress } = await import('./mayachain/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
      case BTCChain: {
        const { verifyAddress } = await import('./bitcoin/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex, hdMode })
        break
      }
      case LTCChain: {
        const { verifyAddress } = await import('./litecoin/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
      case BCHChain: {
        const { verifyAddress } = await import('./bitcoincash/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
      case DOGEChain: {
        const { verifyAddress } = await import('./doge/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
      case DASHChain: {
        const { verifyAddress } = await import('./dash/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
      case ETHChain:
      case AVAXChain:
      case BASEChain:
      case BSCChain:
      case ARBChain: {
        if (!isEvmHDMode(hdMode)) throw Error(`Invalid 'EvmHDMode' - needed for ${chain} to verify Ledger address`)
        const { verifyEVMAddress } = await import('./evm/address')
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
      case GAIAChain: {
        const { verifyAddress } = await import('./cosmos/address')
        result = await verifyAddress(t, walletAccount, walletIndex, network)
        break
      }
      case XRPChain: {
        const { verifyAddress } = await import('./ripple/address')
        result = await verifyAddress(t, walletAccount, walletIndex, network)
        break
      }
      case SOLChain: {
        const { verifyAddress } = await import('./solana/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
      case TRONChain: {
        const { verifyAddress } = await import('./tron/address')
        result = await verifyAddress({ transport: t, network, walletAccount, walletIndex })
        break
      }
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
