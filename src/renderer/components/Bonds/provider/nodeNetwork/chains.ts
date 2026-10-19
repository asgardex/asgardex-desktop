import { NodeInfo } from '../../../../services/thorchain/types'
import { activeNodes, isFiniteNumber } from './common'

export const CHAIN_LAG_WARN_BLOCKS: Record<string, number> = {
  BTC: 3,
  BCH: 3,
  LTC: 5,
  DASH: 5,
  DOGE: 10,
  ZEC: 10,
  ETH: 50,
  GAIA: 100,
  XRP: 150,
  BSC: 200,
  TRON: 200,
  AVAX: 300,
  BASE: 300,
  SOL: 1500
}
export const CHAIN_LAG_WARN_BLOCKS_DEFAULT = 100

export const chainHeights = (nodes: NodeInfo[]): Map<string, number> => {
  const heights = new Map<string, number>()
  for (const node of activeNodes(nodes)) {
    for (const { chain, height } of node.observeChains) {
      if (!chain || !isFiniteNumber(height) || height <= 0) continue
      heights.set(chain, Math.max(heights.get(chain) ?? 0, height))
    }
  }
  return heights
}

export type ChainLag = { chain: string; height: number; networkHeight: number; lag: number }

export const chainLag = (node: NodeInfo, heights: Map<string, number>): ChainLag[] =>
  node.observeChains
    .filter(({ chain }) => !!chain)
    .map(({ chain, height }) => {
      const nodeHeight = isFiniteNumber(height) ? height : 0
      const networkHeight = Math.max(heights.get(chain) ?? nodeHeight, nodeHeight)
      return { chain, height: nodeHeight, networkHeight, lag: Math.max(networkHeight - nodeHeight, 0) }
    })
    .sort((a, b) => (a.chain < b.chain ? -1 : a.chain > b.chain ? 1 : 0))

export const chainLagThreshold = (chain: string): number =>
  CHAIN_LAG_WARN_BLOCKS[chain.toUpperCase()] ?? CHAIN_LAG_WARN_BLOCKS_DEFAULT
