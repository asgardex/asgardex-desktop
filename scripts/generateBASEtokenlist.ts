import { BASEChain } from '@xchainjs/xchain-base'
import { AnyAsset, assetFromStringEx } from '@xchainjs/xchain-util'
import ansis from 'ansis'
import axios from 'axios'
import * as IO from 'fp-ts/IO'
import * as C from 'fp-ts/lib/Console'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as TE from 'fp-ts/lib/TaskEither'
import * as S from 'fp-ts/string'
import * as T from 'fp-ts/Task'
import { failure } from 'io-ts/lib/PathReporter'
import prettier from 'prettier'

import { writeFile, readFile } from '../src/main/utils/file'
import { ERC20Whitelist, erc20WhitelistIO } from '../src/renderer/services/thorchain/types'

// URL and file paths
const WHITELIST_URL =
  'https://gitlab.com/thorchain/thornode/-/raw/develop/common/tokenlist/basetokens/base_mainnet_latest.json'
const PATH = './src/renderer/types/generated/thorchain/baseerc20whitelist.ts'

// Asset list type
type AssetList = { asset: AnyAsset; iconUrl: O.Option<string> }[]

// Transform JSON tokens to `AssetList` format

const transformList = ({ tokens }: Pick<ERC20Whitelist, 'tokens'>): AssetList =>
  tokens.map(({ address, symbol, logoURI }) => ({
    asset: assetFromStringEx(`${BASEChain}.${symbol}-${address}`),
    iconUrl: O.fromNullable(logoURI),
    chainId: 8453
  }))
// Load the token list from the URL
const loadList = (): TE.TaskEither<Error, ERC20Whitelist> =>
  FP.pipe(
    TE.tryCatch(
      () => axios.get<ERC20Whitelist>(WHITELIST_URL),
      (e: unknown) => new Error(`${e}`)
    ),
    TE.map((resp) => ({
      ...resp.data,
      version: resp.data.version || { major: 1, minor: 0, patch: 0 }, // Add default version if missing
      tokens: resp.data.tokens.map((token) => ({ ...token, chainId: 8453 })) // Add default chainId
    })),
    TE.chain((resp) =>
      FP.pipe(
        erc20WhitelistIO.decode(resp),
        E.mapLeft((errors) => new Error(failure(errors).join('\n'))),
        TE.fromEither
      )
    )
  )

const createTemplate = (list: AssetList): string => `
  /**
   * BASE_TOKEN_WHITELIST
   * This file has been generated - don't edit.
   */
  import * as O from 'fp-ts/lib/Option'
  import { TokenAsset } from '@xchainjs/xchain-util';
  import { BASEChain } from '@xchainjs/xchain-base';

  export const BASE_TOKEN_WHITELIST: { asset: TokenAsset; iconUrl: O.Option<string> }[] = [
    ${list
      .map(
        ({ asset, iconUrl }) => `
        {
          asset: {
            chain: BASEChain,
            symbol: "${asset.symbol}",
            ticker: "${asset.ticker}",
            type: 1
          },
          iconUrl: ${O.isSome(iconUrl) ? `O.some('${iconUrl.value}')` : 'O.none'}
        }
      `
      )
      .join(',\n')}
  ]
`

// Write the whitelist to file
const writeList = (list: AssetList): TE.TaskEither<Error, void> =>
  FP.pipe(list, createTemplate, S.replace(/"chain":"BASE"/g, 'chain: BASEChain'), (c) => writeFile(PATH, c))

// Format the generated file
const formatList = () =>
  FP.pipe(
    readFile(PATH, 'utf8'),
    TE.chain((content) => writeFile(PATH, prettier.format(content, { filepath: PATH })))
  )

// Error and success handlers
const onError = (e: Error): T.Task<void> =>
  T.fromIO(
    FP.pipe(
      C.log(ansis.bold.red('Unexpected Error!')),
      IO.chain(() => C.error(e))
    )
  )

const onSuccess = (): T.Task<void> =>
  T.fromIO(
    FP.pipe(
      C.info(ansis.green.bold(`Created whitelist successfully!`)),
      IO.chain(() => C.log(`Location: ${PATH}`))
    )
  )

// Main function to run the script
const main = FP.pipe(
  C.info(ansis.italic.gray(`Generate whitelist...`)),
  TE.fromIO,
  TE.mapLeft(E.toError),
  TE.chain(loadList),
  TE.map(transformList),
  TE.chain(writeList),
  TE.chain(formatList),
  TE.fold(onError, onSuccess)
)

main()
