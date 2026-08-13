import { shell } from 'electron'

const EXTERNALS_WHITELIST = [
  'thorchain.net',
  'testnet.thorchain.net',
  'docs.thorchain.org',
  'dev.thorchain.org',
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
  'scan.chainflip.io',
  'testnet.midgard.thorchain.info',
  'gateway.liquify.com',
  'mayanode.mayachain.info',
  'testnet.thornode.thorchain.info',
  'midgard.thorchain.network',
  'thornode.thorchain.network',
  'rpc.thorchain.network',
  'www.mintscan.io',
  'explorer.theta-testnet.polypore.xyz',
  'snowtrace.dev',
  'routescan.io',
  'bscscan.com',
  'track.thorchain.org',
  'www.xscanner.org',
  'explorer.mayachain.info',
  'www.explorer.mayachain.info',
  'insight.dash.org',

  'midgard.mayachain.com',
  'asgardex.com',
  'arbiscan.io',
  'mainnet.radixdlt.com',
  'dashboard.radixdlt.com',
  'explorer.solana.com',
  'adastat.net',
  'tronscan.org',
  'suiscan.xyz',
  'basescan.org',
  'x.com',
  'livenet.xrpl.org'
]

export const openExternal = (target: string) => {
  try {
    const hostname = new URL(target)?.hostname ?? ''
    if (EXTERNALS_WHITELIST.includes(hostname)) {
      return shell.openExternal(target)
    }
    return Promise.reject(`URL ${target} has been blocked by ASGARDEX`)
  } catch (_e) {
    return Promise.reject(`URL ${target} could not be parsed`)
  }
}
