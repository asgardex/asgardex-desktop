import { shell } from 'electron'

const EXTERNALS_WHITELIST = [
  'thorchain.net',
  'testnet.thorchain.net',
  'docs.thorchain.org',
  'docs.mayaprotocol.com',
  'discord.gg',
  'twitter.com',
  'github.com',
  'explorer.binance.org',
  'testnet-explorer.binance.org',
  'blockstream.info',
  'dex.binance.org',
  'testnet-dex.binance.org',
  'thoryield.com',
  'app.thoryield.com',
  'etherscan.io',
  'ropsten.etherscan.io',
  'tltc.bitaps.com',
  'ltc.bitaps.com',
  'www.blockchain.com',
  'api.blockcypher.com',
  'blockchair.com',
  'blockexplorer.one',
  'testnet.thorswap.finance',
  'stagenet.thorswap.finance',
  'app.thorswap.finance',
  'viewblock.io',
  'runescan.io',
  'testnet.midgard.thorchain.info',
  'stagenet-midgard.ninerealms.com',
  'testnet-rpc.ninerealms.com',
  'stagenet-rpc.ninerealms.com',
  'rpc.ninerealms.com',
  'testnet.thornode.thorchain.info',
  'stagenet-thornode.ninerealms.com',
  'stagenet-rpc.ninerealms.com',
  'bigdipper.live',
  'explorer.theta-testnet.polypore.xyz',
  'snowtrace.dev',
  'routescan.io',
  'bscscan.com',
  'track.ninerealms.com',
  'mayascan.org',
  'www.mayascan.org',
  'explorer.mayachain.info',
  'insight.dash.org',
  'finder.kujira.network',
  'midgard.ninerealms.com',
  'asgardex.com',
  'arbiscan.io',
  'mainnet.radixdlt.com',
  'dashboard.radixdlt.com'
]

export const openExternal = (target: string) => {
  try {
    const hostname = new URL(target)?.hostname ?? ''
    if (EXTERNALS_WHITELIST.includes(hostname)) {
      return shell.openExternal(target)
    }
    return Promise.reject(`URL ${target} has been blocked by ASGARDEX`)
  } catch (e) {
    return Promise.reject(`URL ${target} could not be parsed`)
  }
}
