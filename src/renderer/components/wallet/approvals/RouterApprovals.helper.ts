import { ARBChain, AssetAETH } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX, AVAXChain } from '@xchainjs/xchain-avax'
import { AssetBETH, BASEChain } from '@xchainjs/xchain-base'
import { AssetBSC, BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { AssetETH, ETHChain } from '@xchainjs/xchain-ethereum'
import { assetAmount, assetToBase, AssetType, baseToAsset, Chain, TokenAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, option as O } from 'fp-ts'

import { isEVMTokenAsset, getEVMTokenAddress } from '../../../helpers/assetHelper'
import { WalletBalance, WalletBalances } from '../../../services/wallet/types'
import { ApprovalTokenOption, FormattedAllowance } from './RouterApprovals.types'

/** Threshold at/above which we display "Unlimited" (same heuristic as xchain-suite). */
export const UNLIMITED_THRESHOLD = new BigNumber(2).pow(128)

export const EVM_APPROVAL_CHAINS: Chain[] = [ETHChain, AVAXChain, BSCChain, ARBChain, BASEChain]

/** Native gas asset tickers — used only as chain labels in the selector. */
export const chainNativeTicker = (chain: Chain): string => {
  switch (chain) {
    case ETHChain:
      return AssetETH.ticker
    case AVAXChain:
      return AssetAVAX.ticker
    case BSCChain:
      return AssetBSC.ticker
    case ARBChain:
      return AssetAETH.ticker
    case BASEChain:
      return AssetBETH.ticker
    default:
      return chain
  }
}

/**
 * Chain dropdown label. Avoids redundant `ETH (ETH)` — only appends the native
 * ticker when it differs from the chain id (e.g. `ARB (ETH)`).
 */
export const formatChainOptionLabel = (chain: Chain): string => {
  const ticker = chainNativeTicker(chain)
  if (ticker.toUpperCase() === chain.toUpperCase()) return chain
  return `${chain} (${ticker})`
}

/**
 * Curated mainnet ERC-20 fallbacks when the wallet has no token balances on the chain.
 * Addresses are checksummed mainnet contracts.
 */
export const CURATED_TOKENS: ApprovalTokenOption[] = [
  {
    asset: {
      chain: ETHChain,
      symbol: 'USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7',
      ticker: 'USDT',
      type: AssetType.TOKEN
    },
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    ticker: 'USDT'
  },
  {
    asset: {
      chain: ETHChain,
      symbol: 'USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ticker: 'USDC',
      type: AssetType.TOKEN
    },
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    ticker: 'USDC'
  },
  {
    asset: {
      chain: ETHChain,
      symbol: 'DAI-0x6B175474E89094C44Da98b954EedeAC495271d0F',
      ticker: 'DAI',
      type: AssetType.TOKEN
    },
    contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    ticker: 'DAI'
  },
  {
    asset: {
      chain: ETHChain,
      symbol: 'WBTC-0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      ticker: 'WBTC',
      type: AssetType.TOKEN
    },
    contractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    ticker: 'WBTC'
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: 'USDC-0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      ticker: 'USDC',
      type: AssetType.TOKEN
    },
    contractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    decimals: 6,
    ticker: 'USDC'
  },
  {
    asset: {
      chain: BSCChain,
      symbol: 'USDT-0x55d398326f99059fF775485246999027B3197955',
      ticker: 'USDT',
      type: AssetType.TOKEN
    },
    contractAddress: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    ticker: 'USDT'
  },
  {
    asset: {
      chain: ARBChain,
      symbol: 'USDC-0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      ticker: 'USDC',
      type: AssetType.TOKEN
    },
    contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    ticker: 'USDC'
  },
  {
    asset: {
      chain: BASEChain,
      symbol: 'USDC-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      ticker: 'USDC',
      type: AssetType.TOKEN
    },
    contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    ticker: 'USDC'
  }
]

export const tokensForChain = (
  chain: Chain,
  walletBalances: WalletBalances,
  network: Network = Network.Mainnet
): ApprovalTokenOption[] => {
  const fromWallet: ApprovalTokenOption[] = FP.pipe(walletBalances, (balances) =>
    balances.flatMap((wb: WalletBalance) => {
      const asset = wb.asset as TokenAsset
      if (!isEVMTokenAsset(asset) || asset.chain !== chain) return []
      return FP.pipe(
        getEVMTokenAddress(asset),
        O.fold(
          (): ApprovalTokenOption[] => [],
          (contractAddress) => [
            {
              asset,
              contractAddress,
              decimals: wb.amount.decimal,
              ticker: asset.ticker
            }
          ]
        )
      )
    })
  )

  if (fromWallet.length > 0) return fromWallet

  // Curated list is mainnet-only — never surface mainnet contracts on testnet/stagenet
  if (network !== Network.Mainnet) return []

  return CURATED_TOKENS.filter((t) => t.asset.chain === chain)
}

export const formatAllowance = (
  amount: FormattedAllowance['amount'],
  unlimitedLabel: string,
  noneLabel: string
): FormattedAllowance => {
  const rawBn = amount.amount()
  const raw = rawBn.toFixed(0)
  if (rawBn.isZero()) {
    return { formatted: noneLabel, raw, isUnlimited: false, amount }
  }
  if (rawBn.gte(UNLIMITED_THRESHOLD)) {
    return { formatted: unlimitedLabel, raw, isUnlimited: true, amount }
  }
  const assetAmt = baseToAsset(amount)
  const decimals = Math.min(amount.decimal, 6)
  return {
    formatted: assetAmt.amount().toFixed(decimals),
    raw,
    isUnlimited: false,
    amount
  }
}

export const approveBaseAmount = (humanAmount: BigNumber, decimals: number, unlimited: boolean) => {
  if (unlimited) return undefined
  return assetToBase(assetAmount(humanAmount, decimals))
}
