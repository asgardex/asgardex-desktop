import { shell } from 'electron'

const EXTERNALS_WHITELIST = [
  'thorchain.net',
  'stagenet.thorchain.net',
  'docs.thorchain.org',
  'docs.mayaprotocol.com',
  'discord.gg',
  'twitter.com',
  'github.com',
  'explorer.binance.org',
  'blockstream.info',
  'dex.binance.org',
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
  'stagenet.thorswap.finance',
  'app.thorswap.finance',
  'viewblock.io',
  'runescan.io',
  'stagenet-midgard.ninerealms.com',
  'stagenet-rpc.ninerealms.com',
  'rpc.ninerealms.com',
  'stagenet-thornode.ninerealms.com',
  'stagenet-rpc.ninerealms.com',
  'www.mintscan.io',
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
