import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { getPrefix as getBitcoinPrefix } from '@xchainjs/xchain-bitcoin'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { getPrefix as getBCHPrefix } from '@xchainjs/xchain-bitcoincash'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { getPrefix as getCosmosPrefix } from '@xchainjs/xchain-cosmos'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { getPrefix as getDashPrefix } from '@xchainjs/xchain-dash'
import { getPrefix as getDogePrefix } from '@xchainjs/xchain-doge'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { getPrefix as getEvmPrefix } from '@xchainjs/xchain-evm'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { getPrefix as getLitecoinPrefix } from '@xchainjs/xchain-litecoin'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { getPrefix as getMayachainPrefix } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { getPrefix as getThorchainPrefix } from '@xchainjs/xchain-thorchain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, Chain } from '@xchainjs/xchain-util'
import { ethers } from 'ethers'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { isSupportedChain } from '../../shared/utils/chain'
import { LedgerAddresses } from '../services/wallet/types'
import { eqChain } from './fp/eq'

export const truncateAddress = (addr: Address, chain: Chain, network: Network): string => {
  const first = addr.substring(0, Math.max(getAddressPrefixLength(chain, network) + 3, 6))
  const last = addr.substring(addr.length - 3, addr.length)
  return `${first}...${last}`
}

const chainPrefixLengthFunctions: Record<Chain, (network: Network) => number> = {
  [BTCChain]: (network: Network) => getBitcoinPrefix(network).length,
  [GAIAChain]: () => getCosmosPrefix().length,
  [ETHChain]: () => getEvmPrefix().length,
  [ARBChain]: () => getEvmPrefix().length,
  [AVAXChain]: () => getEvmPrefix().length,
  [BSCChain]: () => getEvmPrefix().length,
  [DOGEChain]: (network: Network) => getDogePrefix(network).length,
  [THORChain]: (network: Network) => getThorchainPrefix(network).length,
  [MAYAChain]: (network: Network) => getMayachainPrefix(network).length,
  [LTCChain]: (network: Network) => getLitecoinPrefix(network).length,
  [DASHChain]: (network: Network) => getDashPrefix(network).length,
  [BCHChain]: () => getBCHPrefix().length,
  [KUJIChain]: () => 'kujira'.length, // tobefixed
  [RadixChain]: () => 'account_'.length // tobefixed
}

export const getAddressPrefixLength = (chain: Chain, network: Network): number => {
  if (!isSupportedChain(chain)) throw new Error(`${chain} is not supported for 'getAddressPrefixLength'`)

  const getPrefixLength = chainPrefixLengthFunctions[chain]
  if (!getPrefixLength) throw new Error(`No prefix length function found for chain ${chain}`)

  return getPrefixLength(network)
}

/**
 * Removes a prefix from an address, if the prefix ends with ':'
 * (currently needed for BCH only)
 */
export const removeAddressPrefix = (address: Address): Address => {
  const prefixIndex = address.indexOf(':') + 1
  return address.substring(prefixIndex > 0 ? prefixIndex : 0)
}

/**
 * Helper to get ETH address as a checksum address
 * toLowerCase() is needed to handle the ERC20 addresses start with 0X as well, not only 0x
 * ethers getAddress function recognize 0X address as invalid one
 */
export const getEthChecksumAddress = (address: Address): O.Option<Address> =>
  O.tryCatch(() => ethers.utils.getAddress(address.toLowerCase()))

/**
 * Helper to get Arb address as a checksum address
 * toLowerCase() is needed to handle the ERC20 addresses start with 0X as well, not only 0x
 * ethers getAddress function recognize 0X address as invalid one
 */
export const getArbChecksumAddress = (address: Address): O.Option<Address> =>
  O.tryCatch(() => ethers.utils.getAddress(address.toLowerCase()))

/**
 * Helper to get Avax address as a checksum address
 * toLowerCase() is needed to handle the ERC20 addresses start with 0X as well, not only 0x
 * ethers getAddress function recognize 0X address as invalid one
 */
export const getAvaxChecksumAddress = (address: Address): O.Option<Address> =>
  O.tryCatch(() => ethers.utils.getAddress(address.toLowerCase()))

/**
 * Helper to get Bsc address as a checksum address
 * toLowerCase() is needed to handle the ERC20 addresses start with 0X as well, not only 0x
 * ethers getAddress function recognize 0X address as invalid one
 */
export const getBscChecksumAddress = (address: Address): O.Option<Address> =>
  O.tryCatch(() => ethers.utils.getAddress(address.toLowerCase()))

export const hasLedgerAddress = (addresses: LedgerAddresses, chain: Chain): boolean =>
  FP.pipe(
    addresses,
    A.findFirst(({ chain: ledgerChain }) => eqChain.equals(chain, ledgerChain)),
    O.map((_) => true),
    O.getOrElse(() => false)
  )
