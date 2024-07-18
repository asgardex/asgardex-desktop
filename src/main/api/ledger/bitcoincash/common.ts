import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

import { LedgerErrorId } from '../../../../shared/api/types'

// TODO(@veado) Extend`xchain-bitcoincash` to get derivation path from it
// Similar to default values in `Client` of `xchain-bitcoincash`
// see https://github.com/xchainjs/xchainjs-lib/blob/56adf1e0d6ceab0bdf93f53fe808fe45bf79930f/packages/xchain-bitcoincash/src/client.ts#L65-L69
export const getDerivationPath = (walletAccount: number, walletIndex: number, network: Network): string => {
  const DERIVATION_PATHES = {
    [Network.Mainnet]: ["44'", "145'", `${walletAccount}'`, 0, walletIndex],
    [Network.Testnet]: ["44'", "1'", `${walletAccount}'`, 0, walletIndex],
    [Network.Stagenet]: ["44'", "145'", `${walletAccount}'`, 0, walletIndex]
  }
  const path = DERIVATION_PATHES[network].join('/')
  return path
}
export const getDerivationPaths = (
  walletAccount: number,
  walletIndex: number,
  network: Network
): RootDerivationPaths => {
  const paths: RootDerivationPaths = {
    [Network.Mainnet]: `${getDerivationPath(walletAccount, walletIndex, network)}`,
    [Network.Testnet]: `${getDerivationPath(walletAccount, walletIndex, network)}`,
    [Network.Stagenet]: `${getDerivationPath(walletAccount, walletIndex, network)}`
  }
  return paths
}

export const fromLedgerErrorType = (error: number): LedgerErrorId => {
  switch (error) {
    default:
      return LedgerErrorId.UNKNOWN
  }
}
