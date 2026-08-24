import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { AssetType, baseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { describe, expect, it } from 'vitest'

import { WalletType } from '../../../../shared/wallet/types'

import {
  approveBaseAmount,
  formatAllowance,
  formatChainOptionLabel,
  tokensForChain,
  UNLIMITED_THRESHOLD
} from './RouterApprovals.helper'

describe('RouterApprovals.helper', () => {
  it('formatAllowance shows None for zero', () => {
    const result = formatAllowance(baseAmount(0, 18), 'Unlimited', 'None')
    expect(result.formatted).toBe('None')
    expect(result.isUnlimited).toBe(false)
  })

  it('formatAllowance shows Unlimited above threshold', () => {
    const result = formatAllowance(baseAmount(UNLIMITED_THRESHOLD.toFixed(), 18), 'Unlimited', 'None')
    expect(result.formatted).toBe('Unlimited')
    expect(result.isUnlimited).toBe(true)
  })

  it('formatAllowance formats finite amounts', () => {
    const result = formatAllowance(baseAmount('1000000', 6), 'Unlimited', 'None')
    expect(result.formatted).toBe('1.000000')
    expect(result.raw).toBe('1000000')
  })

  it('approveBaseAmount omits amount when unlimited', () => {
    expect(approveBaseAmount(new BigNumber(10), 6, true)).toBeUndefined()
  })

  it('approveBaseAmount converts human amount when limited', () => {
    const amount = approveBaseAmount(new BigNumber(1.5), 6, false)
    expect(amount?.amount().toFixed()).toBe('1500000')
  })

  it('formatChainOptionLabel omits redundant ticker for ETH', () => {
    expect(formatChainOptionLabel(ETHChain)).toBe('ETH')
  })

  it('formatChainOptionLabel appends ticker when it differs (ARB)', () => {
    expect(formatChainOptionLabel(ARBChain)).toBe('ARB (ETH)')
  })

  it('tokensForChain falls back to curated list on mainnet when wallet has no ERC20s', () => {
    const tokens = tokensForChain(ETHChain, [], Network.Mainnet)
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.every((t) => t.asset.chain === ETHChain)).toBe(true)
  })

  it('tokensForChain does not return curated mainnet tokens on testnet', () => {
    expect(tokensForChain(ETHChain, [], Network.Testnet)).toEqual([])
  })

  it('tokensForChain prefers wallet ERC20 balances', () => {
    const tokens = tokensForChain(
      ETHChain,
      [
        {
          asset: {
            chain: ETHChain,
            symbol: 'DAI-0x6B175474E89094C44Da98b954EedeAC495271d0F',
            ticker: 'DAI',
            type: AssetType.TOKEN
          },
          amount: baseAmount(1, 18),
          walletAddress: '0xabc',
          walletType: WalletType.Keystore,
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }
      ],
      Network.Testnet
    )
    expect(tokens).toHaveLength(1)
    expect(tokens[0].ticker).toBe('DAI')
  })
})
