import Transport from '@ledgerhq/hw-transport'
import TransportNodeHidSingleton from '@ledgerhq/hw-transport-node-hid-singleton'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
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
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import * as E from 'fp-ts/Either'

import { IPCLedgerAdddressParams, LedgerError, LedgerErrorId } from '../../../shared/api/types'
import { isSupportedChain } from '../../../shared/utils/chain'
import { isError, isEvmHDMode } from '../../../shared/utils/guard'
import { HDMode, WalletAddress } from '../../../shared/wallet/types'
import { getAddress as getARBAddress, verifyAddress as verifyARBAddress } from './arb/address'
import { getAddress as getAVAXAddress, verifyAddress as verifyAVAXAddress } from './avax/address'
import { getAddress as getBTCAddress, verifyAddress as verifyBTCAddress } from './bitcoin/address'
import { getAddress as getBCHAddress, verifyAddress as verifyBCHAddress } from './bitcoincash/address'
import { getAddress as getBSCAddress, verifyAddress as verifyBSCAddress } from './bsc/address'
import { getAddress as getCOSMOSAddress, verifyAddress as verifyCOSMOSAddress } from './cosmos/address'
import { getAddress as getDASHAddress, verifyAddress as verifyDASHAddress } from './dash/address'
import { getAddress as getDOGEAddress, verifyAddress as verifyDOGEAddress } from './doge/address'
import { getAddress as getETHAddress, verifyAddress as verifyETHAddress } from './ethereum/address'
import { getAddress as getLTCAddress, verifyAddress as verifyLTCAddress } from './litecoin/address'
import { getAddress as getTHORAddress, verifyAddress as verifyTHORAddress } from './thorchain/address'

const chainAddressFunctions: Record<
  Chain,
  (
    transport: Transport,
    network: Network,
    walletAccount: number,
    walletIndex: number,
    hdMode?: HDMode
  ) => Promise<E.Either<LedgerError, WalletAddress>>
> = {
  [THORChain]: getTHORAddress,
  [BTCChain]: getBTCAddress,
  [LTCChain]: getLTCAddress,
  [BCHChain]: getBCHAddress,
  [DOGEChain]: getDOGEAddress,
  [DASHChain]: getDASHAddress,
  [ETHChain]: (transport, network, walletAccount, walletIndex, hdMode) => {
    if (!isEvmHDMode(hdMode)) {
      return Promise.resolve(
        E.left({
          errorId: LedgerErrorId.INVALID_ETH_DERIVATION_MODE,
          msg: `Invalid 'EthHDMode' - needed for ETH to get Ledger address`
        })
      )
    }
    return getETHAddress({ transport, walletAccount, walletIndex, evmHDMode: hdMode, network })
  },
  [AVAXChain]: (transport, network, walletAccount, walletIndex, hdMode) => {
    if (!isEvmHDMode(hdMode)) {
      return Promise.resolve(
        E.left({
          errorId: LedgerErrorId.INVALID_ETH_DERIVATION_MODE,
          msg: `Invalid 'AvaxHDMode' - needed for AVAX to get Ledger address`
        })
      )
    }
    return getAVAXAddress({ transport, walletAccount, walletIndex, evmHdMode: hdMode })
  },
  [BSCChain]: (transport, network, walletAccount, walletIndex, hdMode) => {
    if (!isEvmHDMode(hdMode)) {
      return Promise.resolve(
        E.left({
          errorId: LedgerErrorId.INVALID_ETH_DERIVATION_MODE,
          msg: `Invalid 'BscHDMode' - needed for BSC to get Ledger address`
        })
      )
    }
    return getBSCAddress({ transport, network, walletAccount, walletIndex, evmHDMode: hdMode })
  },
  [ARBChain]: (transport, network, walletAccount, walletIndex, hdMode) => {
    if (!isEvmHDMode(hdMode)) {
      return Promise.resolve(
        E.left({
          errorId: LedgerErrorId.INVALID_ETH_DERIVATION_MODE,
          msg: `Invalid 'ArbHDMode' - needed for ARB to get Ledger address`
        })
      )
    }
    return getARBAddress({ transport, walletAccount, walletIndex, evmHdMode: hdMode })
  },
  [GAIAChain]: getCOSMOSAddress
}

const unsupportedChains: Chain[] = [MAYAChain, KUJIChain, RadixChain]

export const getAddress = async ({
  chain,
  network,
  walletAccount,
  walletIndex,
  hdMode
}: IPCLedgerAdddressParams): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const transport = await TransportNodeHidSingleton.create()

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

    const res = await addressFunction(transport, network, walletAccount, walletIndex, hdMode)
    await transport.close()
    return res
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}

export const verifyLedgerAddress = async ({
  chain,
  network,
  walletAccount,
  walletIndex,
  hdMode
}: IPCLedgerAdddressParams) => {
  const transport = await TransportNodeHidSingleton.create()
  let result = false

  if (!isSupportedChain(chain)) throw Error(`${chain} is not supported for 'verifyAddress'`)

  switch (chain) {
    case THORChain:
      result = await verifyTHORAddress({ transport, network, walletAccount, walletIndex })
      break
    case BTCChain:
      result = await verifyBTCAddress({ transport, network, walletAccount, walletIndex })
      break
    case LTCChain:
      result = await verifyLTCAddress({ transport, network, walletAccount, walletIndex })
      break
    case BCHChain:
      result = await verifyBCHAddress({ transport, network, walletAccount, walletIndex })
      break
    case DOGEChain:
      result = await verifyDOGEAddress({ transport, network, walletAccount, walletIndex })
      break
    case DASHChain:
      result = await verifyDASHAddress({ transport, network, walletAccount, walletIndex })
      break
    case ETHChain: {
      if (!isEvmHDMode(hdMode)) throw Error(`Invaid 'EthHDMode' - needed for ETH to verify Ledger address`)
      result = await verifyETHAddress({ transport, walletAccount, walletIndex, evmHDMode: hdMode, network })
      break
    }
    case AVAXChain: {
      if (!isEvmHDMode(hdMode)) throw Error(`Invaid 'EvmHDMode' - needed for AVAX to verify Ledger address`)
      result = await verifyAVAXAddress({ transport, walletAccount, walletIndex, evmHdMode: hdMode })
      break
    }
    case BSCChain: {
      if (!isEvmHDMode(hdMode)) throw Error(`Invaid 'EvmHDMode' - needed for BSC to verify Ledger address`)
      result = await verifyBSCAddress({ transport, walletAccount, walletIndex, evmHDMode: hdMode })
      break
    }
    case ARBChain: {
      if (!isEvmHDMode(hdMode)) throw Error(`Invaid 'EvmHDMode' - needed for ARB to verify Ledger address`)
      result = await verifyARBAddress({ transport, walletAccount, walletIndex, evmHdMode: hdMode })
      break
    }
    case GAIAChain:
      result = await verifyCOSMOSAddress(transport, walletAccount, walletIndex, network)
      break
  }
  await transport.close()

  return result
}
