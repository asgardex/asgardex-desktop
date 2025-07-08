import { Provider } from 'ethers'

/**
 * Helper to get current block time (current === pending block)
 * https://docs.ethers.io/ethers.js/v3.0/html/api-providers.html?highlight=timestamp#block-tag
 */
export const getBlocktime = async (provider: Provider): Promise<number> => {
  const block = await provider.getBlock('latest')
  return block?.timestamp ?? 0
}
