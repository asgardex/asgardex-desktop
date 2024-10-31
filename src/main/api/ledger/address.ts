import Transport from '@ledgerhq/hw-transport'
import TransportNodeHidSingleton from '@ledgerhq/hw-transport-node-hid-singleton'
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
import { SOLChain } from '@xchainjs/xchain-solana'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import * as E from 'fp-ts/Either'

import { IPCLedgerAdddressParams, LedgerError, LedgerErrorId } from '../../../shared/api/types'
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
import { getAddress as getTHORAddress, verifyAddress as verifyTHORAddress } from './thorchain/address'

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
  [BTCChain]: getBTCAddress,
  [LTCChain]: getLTCAddress,
  [BCHChain]: getBCHAddress,
  [DOGEChain]: getDOGEAddress,
  [DASHChain]: getDASHAddress,
  [GAIAChain]: getCOSMOSAddress
}

const unsupportedChains: Chain[] = [MAYAChain, KUJIChain, RadixChain, SOLChain]

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
    case ETHChain:
    case AVAXChain:
    case BASEChain:
    case BSCChain:
    case ARBChain: {
      if (!isEvmHDMode(hdMode)) throw Error(`Invalid 'EvmHDMode' - needed for ${chain} to verify Ledger address`)
      result = await verifyEVMAddress({
        chain,
        transport,
        walletAccount,
        walletIndex,
        evmHDMode: hdMode,
        network
      })
      break
    }
    case GAIAChain:
      result = await verifyCOSMOSAddress(transport, walletAccount, walletIndex, network)
      break
  }
  await transport.close()

  return result
}
