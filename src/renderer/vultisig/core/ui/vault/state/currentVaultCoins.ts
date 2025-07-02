import { useMemo } from 'react'
import { Chain } from '../../../chain/Chain'
import { isNativeCoin } from '../../../chain/coin/utils/isNativeCoin'

export const useCurrentVaultCoins = () => {
  return [
    {
      address: '',
      chain: Chain.Bitcoin,
      decimals: 8,
      id: 'BTC',
      logo: 'btc',
      priceProviderId: 'bitcoin',
      ticker: 'BTC'
    }
  ]
}

export const useCurrentVaultNativeCoins = () => {
  const coins = useCurrentVaultCoins()

  return useMemo(() => coins.filter(isNativeCoin), [coins])
}

export const useCurrentVaultAddresses = () => {
  const coins = useCurrentVaultNativeCoins()

  return useMemo(() => {
    return Object.fromEntries(coins.map((coin) => [coin.chain, coin.address])) as Record<Chain, string>
  }, [coins])
}
