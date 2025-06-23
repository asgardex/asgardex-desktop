import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import BigNumber from 'bignumber.js'

export const ETH_OUT_TX_GAS_LIMIT = new BigNumber('35609')
export const ERC20_OUT_TX_GAS_LIMIT = new BigNumber('49610')
export const DEPOSIT_EXPIRATION_OFFSET = 15 * 60 // 15min in seconds
export const EVMZeroAddress = '0x0000000000000000000000000000000000000000'

export const EVMChains = [ETHChain, AVAXChain, BSCChain, ARBChain, BASEChain]
