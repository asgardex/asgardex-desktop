import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { ethers } from 'ethers'

export const ETH_OUT_TX_GAS_LIMIT = ethers.BigNumber.from('35609')
export const ERC20_OUT_TX_GAS_LIMIT = ethers.BigNumber.from('49610')
export const DEPOSIT_EXPIRATION_OFFSET = 15 * 60 // 15min in seconds
export const EVMZeroAddress = '0x0000000000000000000000000000000000000000'

export const EVMChains = [ETHChain, AVAXChain, BSCChain, ARBChain, BASEChain]
