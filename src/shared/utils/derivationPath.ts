import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
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
import { Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'

import { getDerivationPath as getEvmDerivationPath } from '../evm/ledger'
import { EvmHDMode } from '../evm/types'
import { UtxoHDMode } from '../utxo/types'
import { HDMode } from '../wallet/types'

export type ChainDerivationInfo = {
  path: string
  description: string
}

/**
 * Get derivation path information for any supported chain
 */
export const getChainDerivationPath = (
  chain: Chain,
  account: number,
  index: number,
  network: Network = Network.Mainnet,
  hdMode?: HDMode
): ChainDerivationInfo => {
  const coinType = network === Network.Testnet ? "1'" : "0'"

  switch (chain) {
    // Bitcoin family (UTXO chains with multiple derivation options)
    case BTCChain: {
      const utxoMode = (hdMode as UtxoHDMode) || 'p2wpkh'
      switch (utxoMode) {
        case 'p2wpkh':
          return {
            path: `m/84'/${coinType}/${account}'/0/${index}`,
            description: `Native Segwit P2WPKH (m/84'/${coinType}/${account}'/0/${index})`
          }
        case 'p2tr':
          return {
            path: `m/86'/${coinType}/${account}'/0/${index}`,
            description: `Taproot P2TR (m/86'/${coinType}/${account}'/0/${index})`
          }
        default:
          return {
            path: `m/84'/${coinType}/${account}'/0/${index}`,
            description: `Native Segwit P2WPKH (m/84'/${coinType}/${account}'/0/${index})`
          }
      }
    }

    // Other UTXO chains - they typically use P2WPKH derivation
    case BCHChain:
      return {
        path: `m/44'/145'/${account}'/0/${index}`,
        description: `BIP44 (m/44'/145'/${account}'/0/${index})`
      }
    case LTCChain:
      return {
        path: `m/84'/2'/${account}'/0/${index}`,
        description: `P2WPKH (m/84'/2'/${account}'/0/${index})`
      }
    case DASHChain:
      return {
        path: `m/44'/5'/${account}'/0/${index}`,
        description: `BIP44 (m/44'/5'/${account}'/0/${index})`
      }
    case DOGEChain:
      return {
        path: `m/44'/3'/${account}'/0/${index}`,
        description: `BIP44 (m/44'/3'/${account}'/0/${index})`
      }

    // Ethereum family (EVM chains with multiple derivation modes)
    case ETHChain:
    case BSCChain:
    case AVAXChain:
    case ARBChain:
    case BASEChain: {
      const evmMode = (hdMode as EvmHDMode) || 'ledgerlive'
      const basePath = getEvmDerivationPath(account, evmMode)
      const description = `${evmMode.toUpperCase()} (${basePath}${index})`
      return {
        path: `${basePath}${index}`,
        description
      }
    }

    // Cosmos family
    case GAIAChain:
      return {
        path: `m/44'/118'/${account}'/0/${index}`,
        description: `Cosmos (m/44'/118'/${account}'/0/${index})`
      }
    case THORChain:
      return {
        path: `m/44'/931'/${account}'/0/${index}`,
        description: `THORChain (m/44'/931'/${account}'/0/${index})`
      }
    case MAYAChain:
      return {
        path: `m/44'/931'/${account}'/0/${index}`,
        description: `MAYAChain (m/44'/931'/${account}'/0/${index})`
      }
    case KUJIChain:
      return {
        path: `m/44'/118'/${account}'/0/${index}`,
        description: `Kujira (m/44'/118'/${account}'/0/${index})`
      }

    // Other chains with standard BIP44 derivation
    case ADAChain:
      return {
        path: `m/44'/1815'/${account}'/0/${index}`,
        description: `Cardano (m/44'/1815'/${account}'/0/${index})`
      }
    case XRPChain:
      return {
        path: `m/44'/144'/${account}'/0/${index}`,
        description: `Ripple (m/44'/144'/${account}'/0/${index})`
      }
    case SOLChain:
      return {
        path: `m/44'/501'/${account}'/0/${index}`,
        description: `Solana (m/44'/501'/${account}'/0/${index})`
      }
    case RadixChain:
      return {
        path: `m/44'/1022'/${account}'/0/${index}`,
        description: `Radix (m/44'/1022'/${account}'/0/${index})`
      }
    case ZECChain:
      return {
        path: `m/44'/133'/${account}'/0/${index}`,
        description: `Zcash (m/44'/133'/${account}'/0/${index})`
      }

    default:
      return {
        path: `m/44'/0'/${account}'/0/${index}`,
        description: `Default BIP44 (m/44'/0'/${account}'/0/${index})`
      }
  }
}

/**
 * Check if a chain supports multiple derivation path options
 */
export const chainSupportsMultipleDerivationPaths = (chain: Chain): boolean => {
  switch (chain) {
    case BTCChain: // Bitcoin supports P2WPKH and P2TR
    case ETHChain:
    case BSCChain:
    case AVAXChain:
    case ARBChain:
    case BASEChain: // EVM chains support legacy, ledgerlive, metamask
      return true
    default:
      return false
  }
}

/**
 * Get available derivation path options for chains that support multiple paths
 */
export const getChainDerivationOptions = (
  chain: Chain,
  account: number,
  index: number,
  network: Network = Network.Mainnet
): ChainDerivationInfo[] => {
  switch (chain) {
    case BTCChain:
      return [
        getChainDerivationPath(chain, account, index, network, 'p2wpkh'),
        getChainDerivationPath(chain, account, index, network, 'p2tr')
      ]
    case ETHChain:
    case BSCChain:
    case AVAXChain:
    case ARBChain:
    case BASEChain:
      return [
        getChainDerivationPath(chain, account, index, network, 'ledgerlive'),
        getChainDerivationPath(chain, account, index, network, 'legacy'),
        getChainDerivationPath(chain, account, index, network, 'metamask')
      ]
    default:
      return [getChainDerivationPath(chain, account, index, network)]
  }
}
