import { writeFileSync } from 'fs'
import { AnyAsset, assetFromString } from '@xchainjs/xchain-util'
import axios from 'axios'
import { format } from 'prettier'
import { erc20WhitelistIO, ERC20Whitelist } from '../src/renderer/services/thorchain/types'

type Chain = 'ARB' | 'AVAX' | 'BSC' | 'ETH' | 'BASE' | 'TRON'

interface ChainConfig {
  chain: string
  import: string
  whitelistUrls: string[] // Changed to array to support multiple URLs
  outputPath: string
  whitelistName: string
  chainId?: number
}

function getChainConfig(chain: Chain): ChainConfig {
  switch (chain) {
    case 'ARB':
      return {
        chain: 'ARBChain',
        import: "import { ARBChain } from '@xchainjs/xchain-arbitrum';",
        whitelistUrls: [
          'https://gitlab.com/mayachain/mayanode/-/raw/mainnet/common/tokenlist/arbtokens/arb_mainnet_latest.json'
        ],
        outputPath: './src/renderer/types/generated/mayachain/arberc20whitelist.ts',
        whitelistName: 'ARB_TOKEN_WHITELIST'
      }
    case 'AVAX':
      return {
        chain: 'AVAXChain',
        import: "import { AVAXChain } from '@xchainjs/xchain-avax';",
        whitelistUrls: [
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/avaxtokens/avax_mainnet_latest.json'
        ],
        outputPath: './src/renderer/types/generated/thorchain/avaxerc20whitelist.ts',
        whitelistName: 'AVAX_TOKEN_WHITELIST'
      }
    case 'BSC':
      return {
        chain: 'BSCChain',
        import: "import { BSCChain } from '@xchainjs/xchain-bsc';",
        whitelistUrls: [
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/bsctokens/bsc_mainnet_latest.json'
        ],
        outputPath: './src/renderer/types/generated/thorchain/bscerc20whitelist.ts',
        whitelistName: 'BSC_TOKEN_WHITELIST'
      }
    case 'ETH':
      return {
        chain: 'ETHChain',
        import: "import { ETHChain } from '@xchainjs/xchain-ethereum';",
        whitelistUrls: [
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/ethtokens/eth_mainnet_latest.json',
          'https://gitlab.com/mayachain/mayanode/-/raw/mainnet/common/tokenlist/ethtokens/eth_mainnet_latest.json'
        ],
        outputPath: './src/renderer/types/generated/thorchain/etherc20whitelist.ts',
        whitelistName: 'ETH_TOKEN_WHITELIST'
      }
    case 'BASE':
      return {
        chain: 'BASEChain',
        import: "import { BASEChain } from '@xchainjs/xchain-base';",
        whitelistUrls: [
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/basetokens/base_mainnet_latest.json'
        ],
        outputPath: './src/renderer/types/generated/thorchain/baseErc20whitelist.ts',
        whitelistName: 'BASE_TOKEN_WHITELIST',
        chainId: 8453
      }
    case 'TRON':
      return {
        chain: 'TRONChain',
        import: "import { TRONChain } from '@xchainjs/xchain-tron';",
        whitelistUrls: [
          'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/trontokens/tron_mainnet_latest.json?ref_type=heads'
        ],
        outputPath: './src/renderer/types/generated/thorchain/trontrc20whitelist.ts',
        whitelistName: 'TRON_TOKEN_WHITELIST'
      }
    default:
      throw new Error(`Unsupported chain: ${chain}`)
  }
}

type AssetList = { asset: AnyAsset; iconUrl: string | null }[]

async function loadList(urls: string[], chain: Chain): Promise<ERC20Whitelist> {
  const config = getChainConfig(chain)
  const allTokens: AnyAsset[] = []

  // Fetch tokens from all provided URLs
  for (const url of urls) {
    try {
      const { data } = await axios.get(url)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokens = data.tokens.map((token: any) => ({
        ...token,
        chainId: token.chainId ?? config.chainId // Use token.chainId or fallback to config.chainId or 1
      }))
      allTokens.push(...tokens) // Append tokens to the combined list
    } catch (error) {
      throw new Error(`Failed to load whitelist: ${error}`)
    }
  }

  // Wrap the combined token list
  const wrappedData = {
    tokens: allTokens,
    version: { major: 1, minor: 0, patch: 0 },
    name: 'Merged Token List',
    timestamp: new Date().toISOString(),
    keywords: ['erc20', chain.toLowerCase()]
  }

  const decoded = erc20WhitelistIO.decode(wrappedData)
  if ('_tag' in decoded && decoded._tag === 'Left') {
    const errorMessages = decoded.left.map((e) => JSON.stringify(e, null, 2)).join('\n')
    console.error('Validation errors:', errorMessages)
    throw new Error(`Validation failed: ${errorMessages}`)
  }
  return decoded.right
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
    console.error('Chain argument is required (e.g., ARB, AVAX, BSC, ETH, BASE, TRON)')
    process.exit(1)
  }

  const config = getChainConfig(chain)
  if (!config.outputPath || typeof config.outputPath !== 'string') {
    console.error(`Invalid output path for chain ${chain}`)
    process.exit(1)
  }

  console.log(`Generating whitelist for ${chain}...`)
  try {
    const whitelist = await loadList(config.whitelistUrls, chain)
    const assetList = transformList(whitelist, config.chain.replace('Chain', ''))
    const content = createTemplate(assetList, config).replace(/"chain":"[^"]*"/g, `chain: ${config.chain}`)

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
