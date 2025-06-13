import { writeFileSync } from 'fs'
import { AnyAsset, assetFromString } from '@xchainjs/xchain-util'
import axios from 'axios'
import { format } from 'prettier'
import { erc20WhitelistIO, ERC20Whitelist } from '../src/renderer/services/thorchain/types'

type Chain = 'ARB' | 'AVAX' | 'BSC' | 'ETH' | 'BASE'

interface ChainConfig {
  chain: string
  import: string
  whitelistUrl: string
  outputPath: string
  whitelistName: string
  chainId?: number // Optional chainId for chains missing it in the data
}

function getChainConfig(chain: Chain): ChainConfig {
  switch (chain) {
    case 'ARB':
      return {
        chain: 'ARBChain',
        import: "import { ARBChain } from '@xchainjs/xchain-arbitrum';",
        whitelistUrl:
          'https://gitlab.com/mayachain/mayanode/-/raw/mainnet/common/tokenlist/arbtokens/arb_mainnet_latest.json',
        outputPath: './src/renderer/types/generated/mayachain/arberc20whitelist.ts',
        whitelistName: 'ARB_TOKEN_WHITELIST'
      }
    case 'AVAX':
      return {
        chain: 'AVAXChain',
        import: "import { AVAXChain } from '@xchainjs/xchain-avax';",
        whitelistUrl:
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/avaxtokens/avax_mainnet_latest.json',
        outputPath: './src/renderer/types/generated/thorchain/avaxerc20whitelist.ts',
        whitelistName: 'AVAX_TOKEN_WHITELIST'
      }
    case 'BSC':
      return {
        chain: 'BSCChain',
        import: "import { BSCChain } from '@xchainjs/xchain-bsc';",
        whitelistUrl:
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/bsctokens/bsc_mainnet_latest.json',
        outputPath: './src/renderer/types/generated/thorchain/bscerc20whitelist.ts',
        whitelistName: 'BSC_TOKEN_WHITELIST'
      }
    case 'ETH':
      return {
        chain: 'ETHChain',
        import: "import { ETHChain } from '@xchainjs/xchain-ethereum';",
        whitelistUrl:
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/ethtokens/eth_mainnet_latest.json',
        outputPath: './src/renderer/types/generated/thorchain/etherc20whitelist.ts',
        whitelistName: 'ETH_TOKEN_WHITELIST'
      }
    case 'BASE':
      return {
        chain: 'BASEChain',
        import: "import { BASEChain } from '@xchainjs/xchain-base';",
        whitelistUrl:
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/basetokens/base_mainnet_latest.json',
        outputPath: './src/renderer/types/generated/thorchain/baseErc20whitelist.ts',
        whitelistName: 'BASE_TOKEN_WHITELIST',
        chainId: 8453 // Base mainnet chain ID
      }
    default:
      throw new Error(`Unsupported chain: ${chain}`)
  }
}

type AssetList = { asset: AnyAsset; iconUrl: string | null }[]

async function loadList(url: string, chain: Chain): Promise<ERC20Whitelist> {
  try {
    const { data } = await axios.get(url)
    const config = getChainConfig(chain)
    const wrappedData = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokens: data.tokens.map((token: any) => ({
        ...token,
        chainId: token.chainId ?? config.chainId // Fallback chainId if missing
      })),
      version: { major: 1, minor: 0, patch: 0 },
      name: data.name ?? 'Unknown',
      timestamp: data.timestamp ?? new Date().toISOString(),
      keywords: data.keywords ?? []
    }
    const decoded = erc20WhitelistIO.decode(wrappedData)
    if ('_tag' in decoded && decoded._tag === 'Left') {
      const errorMessages = decoded.left.map((e) => JSON.stringify(e, null, 2)).join('\n')
      console.error('Validation errors:', errorMessages)
      throw new Error(`Validation failed: ${errorMessages}`)
    }
    return decoded.right
  } catch (error) {
    console.error('Raw error:', error)
    throw new Error(`Failed to load whitelist: ${error}`)
  }
}

function transformList({ tokens }: ERC20Whitelist, chain: string): AssetList {
  const seenTokens = new Set<string>()
  if (!tokens) return []
  return tokens
    .map(({ address, symbol, logoURI }) => {
      const identifier = `${symbol.toLowerCase()}-${address.toLowerCase()}`
      if (seenTokens.has(identifier)) return null
      seenTokens.add(identifier)

      const asset = assetFromString(`${chain}.${symbol}-${address}`)
      if (!asset) return null

      return { asset, iconUrl: logoURI ?? null }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

function createTemplate(list: AssetList, config: ChainConfig): string {
  const listAsString = list
    .map(({ asset, iconUrl }) => {
      const iconUrlString = iconUrl ? `O.some('${iconUrl}')` : 'O.none'
      const assetString = `{ chain: ${config.chain}, symbol: "${asset.symbol}", ticker: "${asset.ticker}", type: ${asset.type} }`
      return `{ asset: ${assetString}, iconUrl: ${iconUrlString} }`
    })
    .join(',\n  ')

  return `
    /**
     * ${config.whitelistName}
     * This file has been generated - don't edit.
     */
    import { option as O } from 'fp-ts';
    import { TokenAsset } from '@xchainjs/xchain-util';
    ${config.import}

    export const ${config.whitelistName}: { asset: TokenAsset; iconUrl: O.Option<string> }[] = [
      ${listAsString}
    ];
  `
}

async function main() {
  const chain = process.argv[2] as Chain
  if (!chain) {
    console.error('Chain argument is required (e.g., ARB, AVAX, BSC, ETH, BASE)')
    process.exit(1)
  }

  const config = getChainConfig(chain)
  if (!config.outputPath || typeof config.outputPath !== 'string') {
    console.error(`Invalid output path for chain ${chain}`)
    process.exit(1)
  }

  console.log(`Generating whitelist for ${chain}...`)
  try {
    const whitelist = await loadList(config.whitelistUrl, chain)
    const assetList = transformList(whitelist, config.chain.replace('Chain', ''))
    const content = createTemplate(assetList, config).replace(/"chain":"[^"]*"/g, `chain: ${config.chain}`)

    // Format the content with Prettier
    const formattedContent = await format(content, {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2
    })

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(config.outputPath, formattedContent, 'utf8')
    console.log(`Created and formatted whitelist successfully at ${config.outputPath}`)
  } catch (error) {
    console.error('Unexpected Error!', error)
    process.exit(1)
  }
}

main()
