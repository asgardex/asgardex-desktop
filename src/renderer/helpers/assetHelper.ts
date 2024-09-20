import { AssetAETH, AssetARB } from '@xchainjs/xchain-arbitrum'
import { Network } from '@xchainjs/xchain-client'
import { AssetDASH } from '@xchainjs/xchain-dash'
import { getTokenAddress } from '@xchainjs/xchain-evm'
import { AssetUSK } from '@xchainjs/xchain-kujira'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { CompatibleAsset } from '@xchainjs/xchain-mayachain-query'
import { AssetXRD } from '@xchainjs/xchain-radix'
import {
  Address,
  AnyAsset,
  assetAmount,
  AssetAmount,
  assetFromString,
  AssetType,
  baseAmount,
  BaseAmount,
  bn,
  TokenAsset
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as S from 'fp-ts/lib/string'

import { ArbZeroAddress } from '../../shared/arb/const'
import { AvaxZeroAddress } from '../../shared/avax/const'
import { BscZeroAddress } from '../../shared/bsc/const'
import { ETHAddress } from '../../shared/ethereum/const'
import {
  AssetATOM,
  AssetBCH,
  AssetBTC,
  AssetDOGE,
  AssetETH,
  AssetAVAX,
  AssetBSC,
  AssetLTC,
  AssetRuneNative,
  AssetCacao,
  AssetMaya,
  AssetKUJI
} from '../../shared/utils/asset'
import { isSupportedChain } from '../../shared/utils/chain'
import { AssetTGTERC20, DEFAULT_PRICE_ASSETS, USD_PRICE_ASSETS } from '../const'
import { ARB_TOKEN_WHITELIST } from '../types/generated/mayachain/arberc20whitelist'
import { AVAX_TOKEN_WHITELIST } from '../types/generated/thorchain/avaxerc20whitelist'
import { BSC_TOKEN_WHITELIST } from '../types/generated/thorchain/bscerc20whitelist'
import { ERC20_WHITELIST } from '../types/generated/thorchain/erc20whitelist'
import { PricePoolAsset } from '../views/pools/Pools.types'
import {
  getArbChecksumAddress,
  getAvaxChecksumAddress,
  getBscChecksumAddress,
  getEthChecksumAddress
} from './addressHelper'
import { getChainAsset, isBchChain, isBtcChain, isDogeChain, isEthChain, isLtcChain } from './chainHelper'
import { eqAsset, eqString } from './fp/eq'
import { sequenceTOption } from './fpHelpers'

/**
 * Decimal for any asset handled by THORChain and provided by Midgard
 *
 * Note 1: THORChain will only ever treat assets to be `1e8`
 * Note 2: `THORCHAIN_DECIMAL` has to be used for pools/swap/liquidity only,
 * at wallet parts we will get information about decimal from agardex client libs
 * (eg. `asgardex-binance|bitcoin|ethereum` and others)
 *
 * */
export const THORCHAIN_DECIMAL = 8

export const isAssetInMayachainPools = (asset: AnyAsset): boolean =>
  eqAsset.equals(asset, AssetCacao || AssetDASH || AssetKUJI || AssetXRD)

export const isCompatibleAsset = (asset: AnyAsset): asset is CompatibleAsset => {
  return asset.type === AssetType.NATIVE || asset.type === AssetType.TOKEN || asset.type === AssetType.SYNTH
}

/**
 * Checks whether an asset is an RuneNative asset
 */
export const isRuneNativeAsset = (asset: AnyAsset): boolean => eqAsset.equals(asset, AssetRuneNative)

/**
 * Checks whether an asset is a Rune (native or non-native) asset
 */
export const isRuneAsset = (asset: AnyAsset): boolean => isRuneNativeAsset(asset)

/**
 * Checks whether an asset is a LTC asset
 */
export const isLtcAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetLTC.chain && asset.symbol.toUpperCase() === AssetLTC.symbol.toUpperCase()

/**
 * Checks whether an asset is a BCH asset
 */
export const isBchAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetBCH.chain && asset.symbol.toUpperCase() === AssetBCH.symbol.toUpperCase()

/**
 * Checks whether an asset is a Dash asset
 */
export const isDashAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetDASH.chain && asset.symbol.toUpperCase() === AssetDASH.symbol.toUpperCase()

/**
 * Checks whether an asset is a native | synth | trade Cacao asset
 */
export const isCacaoAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetCacao.chain && asset.symbol.toUpperCase() === AssetCacao.symbol.toUpperCase()

/**
 * Checks whether an asset is a native | synth | trade Maya asset
 */
export const isMayaAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetMaya.chain && asset.symbol.toUpperCase() === AssetMaya.symbol.toUpperCase()

/**
 * Checks whether an asset is a native | synth | trade BTC asset
 */
export const isBtcAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetBTC.chain && asset.symbol.toUpperCase() === AssetBTC.symbol.toUpperCase()

/**
 * Checks whether an asset is a native | synth | trade ETH asset
 */
export const isEthAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetETH.chain && asset.symbol.toUpperCase() === AssetETH.symbol.toUpperCase()

/**
 * Checks whether an asset is an ARB asset
 */
export const isArbAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetARB.chain && asset.symbol.toUpperCase() === AssetARB.symbol.toUpperCase()

/**
 * Checks whether an asset is an ARB ETH asset
 */
export const isAethAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetAETH.chain && asset.symbol.toUpperCase() === AssetAETH.symbol.toUpperCase()

/**
 * Checks whether an asset is an AVAX asset
 */
export const isAvaxAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetAVAX.chain && asset.symbol.toUpperCase() === AssetAVAX.symbol.toUpperCase()

/**
 * Checks whether an asset is an BSC asset
 */
export const isBscAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetBSC.chain && asset.symbol.toUpperCase() === AssetBSC.symbol.toUpperCase()

/**
 * Checks whether an asset is a DOGE asset
 */
export const isDogeAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetDOGE.chain && asset.symbol.toUpperCase() === AssetDOGE.symbol.toUpperCase()
/**
 * Checks whether an asset is a Kuji asset
 */
export const isKujiAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetKUJI.chain && asset.symbol.toUpperCase() === AssetKUJI.symbol.toUpperCase()
/**
 * Checks whether an asset is a Radix asset
 */
export const isXrdAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetXRD.chain && asset.symbol.toUpperCase() === AssetXRD.symbol.toUpperCase()

export const isUskAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetUSK.chain && asset.symbol.toUpperCase() === AssetUSK.symbol.toUpperCase()

/**
 * Checks whether an asset is a ATOM asset
 */
export const isAtomAsset = (asset: AnyAsset): boolean =>
  asset.chain === AssetATOM.chain && asset.symbol.toUpperCase() === AssetATOM.symbol.toUpperCase()

/**
 * Check whether an asset is in a list
 */
export const assetInList =
  (asset: AnyAsset) =>
  (list: AnyAsset[]): boolean =>
    FP.pipe(
      list,
      A.findFirst((assetInList) => {
        return eqAsset.equals(assetInList, asset)
      }),
      O.isSome
    )

/**
 * Checks whether an ERC20 asset is white listed or not
 */
export const assetInERC20Whitelist = (asset: AnyAsset): boolean =>
  FP.pipe(
    ERC20_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInERC20Whitelist = (asset: AnyAsset): O.Option<string> =>
  FP.pipe(
    ERC20_WHITELIST,
    A.findFirst(({ asset: assetInList }) => assetInList.symbol.toUpperCase() === asset.symbol.toUpperCase()),
    O.chain(({ iconUrl }) => iconUrl)
  )
/**
 * Checks whether an ERC20 asset is white listed or not
 */
export const assetInARBERC20Whitelist = (asset: AnyAsset): boolean =>
  FP.pipe(
    ARB_TOKEN_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInARBERC20Whitelist = (asset: AnyAsset): O.Option<string> =>
  FP.pipe(
    ARB_TOKEN_WHITELIST,
    A.findFirst(({ asset: assetInList }) => assetInList.symbol.toUpperCase() === asset.symbol.toUpperCase()),
    O.chain(({ iconUrl }) => iconUrl)
  )

/**
 * Checks whether an ERC20 asset is white listed or not
 */
export const assetInAVAXERC20Whitelist = (asset: AnyAsset): boolean =>
  FP.pipe(
    AVAX_TOKEN_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInAVAXERC20Whitelist = (asset: AnyAsset): O.Option<string> =>
  FP.pipe(
    AVAX_TOKEN_WHITELIST,
    A.findFirst(({ asset: assetInList }) => assetInList.symbol.toUpperCase() === asset.symbol.toUpperCase()),
    O.chain(({ iconUrl }) => iconUrl)
  )

/**
 * Checks whether an ERC20 asset is white listed or not
 */
export const assetInBSCERC20Whitelist = (asset: AnyAsset): boolean =>
  FP.pipe(
    BSC_TOKEN_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInBSCERC20Whitelist = (asset: AnyAsset): O.Option<string> =>
  FP.pipe(
    BSC_TOKEN_WHITELIST,
    A.findFirst(({ asset: assetInList }) => assetInList.symbol.toUpperCase() === asset.symbol.toUpperCase()),
    O.chain(({ iconUrl }) => iconUrl)
  )
/**
 * Checks whether ETH/ERC20 asset is whitelisted or not
 * based on following rules:
 * (1) Check on `mainnet` only
 * (2) Always accept ETH
 * (3) ERC20 asset needs to be listed in `ERC20Whitelist`
 */
export const validAssetForETH = (asset: AnyAsset /* ETH or ERC20 asset */, network: Network): boolean =>
  network !== Network.Mainnet /* (1) */ || isEthAsset(asset) /* (2) */ || assetInERC20Whitelist(asset)

/**
 * Checks whether ETH/ERC20 asset is whitelisted or not
 * based on following rules:
 * (1) Check on `mainnet` only
 * (2) Always accept ETH
 * (3) ERC20 asset needs to be listed in `ARBERC20Whitelist`
 */
export const validAssetForARB = (asset: AnyAsset /* ETH or ERC20 asset */, network: Network): boolean =>
  network !== Network.Mainnet /* (1) */ ||
  isArbAsset(asset) ||
  isAethAsset(asset) /* (2) */ ||
  assetInARBERC20Whitelist(asset)

/**
 * Checks whether AVAX/ERC20 asset is whitelisted or not
 * based on following rules:
 * (1) Check on `mainnet` only
 * (2) Always accept AVAX
 * (3) ERC20 asset needs to be listed in `AVAXERC20Whitelist`
 */
export const validAssetForAVAX = (asset: AnyAsset /* AVAX or ERC20 asset */, network: Network): boolean =>
  network !== Network.Mainnet /* (1) */ || isAvaxAsset(asset) /* (2) */ || assetInAVAXERC20Whitelist(asset)

/**
 * Checks whether BSC/ERC20 asset is whitelisted or not
 * based on following rules:
 * (1) Check on `mainnet` only
 * (2) Always accept BSC
 * (3) ERC20 asset needs to be listed in `ERC20Whitelist`
 * BSC-USD is corrupted. Temporary fix until xchainjs fixes the issue
 */
export const validAssetForBSC = (asset: AnyAsset /* BSC or ERC20 asset */, network: Network): boolean => {
  return network !== Network.Mainnet || isBscAsset(asset) || assetInBSCERC20Whitelist(asset) // Check additional conditions
}

/**
 * Checks whether an ERC20 address is black listed or not
 */
const addressInList = (address: Address, list: TokenAsset[]): boolean => {
  const oChecksumAddress = getEthChecksumAddress(address)
  return FP.pipe(
    list,
    A.findFirst(
      FP.flow(
        getEthTokenAddress,
        (oAddressInList) => sequenceTOption(oAddressInList, oChecksumAddress),
        O.map(([itemAddress, checksumAddress]) => eqString.equals(itemAddress, checksumAddress)),
        O.getOrElse<boolean>(() => false)
      )
    ),
    O.isSome
  )
}

const erc20WhiteListAssetOnly = FP.pipe(
  ERC20_WHITELIST,
  A.map(({ asset }) => asset)
)

const arbTokenWhiteListAssetOnly = FP.pipe(
  ARB_TOKEN_WHITELIST,
  A.map(({ asset }) => asset)
)

const avaxTokenWhiteListAssetOnly = FP.pipe(
  AVAX_TOKEN_WHITELIST,
  A.map(({ asset }) => asset)
)

const bscTokenWhiteListAssetOnly = FP.pipe(
  BSC_TOKEN_WHITELIST,
  A.map(({ asset }) => asset)
)
/**
 * Checks whether an ERC20 address is white listed or not
 */
export const addressInERC20Whitelist = (address: Address): boolean => addressInList(address, erc20WhiteListAssetOnly)

/**
 * Checks whether an ERC20 address is white listed or not
 */
export const addressInArbWhitelist = (address: Address): boolean => addressInList(address, arbTokenWhiteListAssetOnly)

/**
 * Checks whether an ERC20 address is white listed or not
 */
export const addressInAvaxWhitelist = (address: Address): boolean => addressInList(address, avaxTokenWhiteListAssetOnly)

/**
 * Checks whether an ERC20 address is white listed or not
 */
export const addressInBscWhitelist = (address: Address): boolean => addressInList(address, bscTokenWhiteListAssetOnly)

/**
 * Check whether an asset is TGT asset
 */
export const isTgtERC20Asset = (asset: AnyAsset): boolean => eqAsset.equals(asset, AssetTGTERC20)

/**
 * Get ethereum token address (as check sum address) from a given asset
 */
export const getEthTokenAddress: (asset: TokenAsset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getEthChecksumAddress)
)

/**
 * Get arb token address (as check sum address) from a given asset
 */
export const getArbTokenAddress: (asset: TokenAsset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getArbChecksumAddress)
)

/**
 * Get avax token address (as check sum address) from a given asset
 */
export const getAvaxTokenAddress: (asset: TokenAsset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getAvaxChecksumAddress)
)

/**
 * Get Bsc token address (as check sum address) from a given asset
 */
export const getBscTokenAddress: (asset: TokenAsset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getBscChecksumAddress)
)

/**
 * Get address (as check sum address) from an ETH or ETH token asset
 */
export const getEthAssetAddress = (asset: AnyAsset): O.Option<Address> =>
  isEthAsset(asset) ? O.some(ETHAddress) : getEthTokenAddress(asset as TokenAsset)

/**
 * Get address (as check sum address) from an Arb or Arb token asset
 */
export const getArbAssetAddress = (asset: AnyAsset): O.Option<Address> =>
  isAethAsset(asset) ? O.some(ArbZeroAddress) : getArbTokenAddress(asset as TokenAsset)

/**
 * Get address (as check sum address) from an Avax or Avax token asset
 */
export const getAvaxAssetAddress = (asset: AnyAsset): O.Option<Address> =>
  isAvaxAsset(asset) ? O.some(AvaxZeroAddress) : getAvaxTokenAddress(asset as TokenAsset)

/**
 * Get address (as check sum address) from an Bsc or Bsc token asset
 */
export const getBscAssetAddress = (asset: AnyAsset): O.Option<Address> =>
  isBscAsset(asset) ? O.some(BscZeroAddress) : getBscTokenAddress(asset as TokenAsset)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isEthTokenAsset: (asset: TokenAsset) => boolean = FP.flow(getEthTokenAddress, O.isSome)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isArbTokenAsset: (asset: TokenAsset) => boolean = FP.flow(getArbTokenAddress, O.isSome)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isAvaxTokenAsset: (asset: TokenAsset) => boolean = FP.flow(getAvaxTokenAddress, O.isSome)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isBscTokenAsset: (asset: TokenAsset) => boolean = FP.flow(getBscTokenAddress, O.isSome)

// Type guard for `PricePoolAsset`
export const isPricePoolAsset = (asset: AnyAsset): asset is PricePoolAsset =>
  // all of PoolAsset except BSC.BNB -> see `PricePoolAsset`
  [...DEFAULT_PRICE_ASSETS, ...USD_PRICE_ASSETS].includes(asset)

// How should this work for synths tobefixed
export const isChainAsset = (asset: AnyAsset): boolean =>
  isSupportedChain(asset.chain) && eqAsset.equals(asset, getChainAsset(asset.chain))

export const isUSDAsset = ({ ticker }: AnyAsset): boolean =>
  ticker.includes('USD') || ticker.includes('UST') || ticker.includes('DAI') || ticker.includes('usdt')

export const isUtxoAssetChain = ({ chain }: AnyAsset) =>
  isBtcChain(chain) || isBchChain(chain) || isLtcChain(chain) || isDogeChain(chain)

// Assuming you have an appropriate `isTokenAsset` predicate function
export const isTokenAsset = (asset: AnyAsset): asset is TokenAsset => asset.type === AssetType.TOKEN

/**
 * Update ETH token (ERC20) addresses to be based on checksum addresses
 * Other assets then ETH tokens (ERC20) won't be updated and will be returned w/o any changes
 */
export const updateEthChecksumAddress = (asset: AnyAsset): AnyAsset =>
  FP.pipe(
    asset,
    // ETH chain only
    O.fromPredicate(({ chain }) => isEthChain(chain)),
    // ETH asset only
    O.chain(O.fromPredicate(isTokenAsset)),
    // Get token address as checksum address
    O.chain(FP.flow(getTokenAddress, O.fromNullable)),
    // Update asset for using a checksum address
    O.map((address) => ({ ...asset, symbol: `${asset.ticker}-${address}` })),
    // Return same asset in case of no updates
    O.getOrElse(() => asset)
  )

/**
 * Helper to get Midgard assets properly
 */
export const midgardAssetFromString: (assetString: string) => O.Option<AnyAsset> = FP.flow(
  assetFromString,
  O.fromNullable,
  // FOR ETH tokens we need to update its addresses to have a valid check sum address
  // Because ERC20 assets from Midgard might start with 0X rather than 0x
  // And 0X isn't recognized as valid address in ethers lib
  O.map(updateEthChecksumAddress)
)

/**
 * Helper to convert decimal of asset amounts
 *
 * It can be used to convert Midgard/THORChain amounts,
 * which are always based on 1e8 decimal into any 1e(n) decimal
 *
 * Examples:
 * ETH.ETH: 1e8 -> 1e18
 * ETH.USDT: 1e8 -> 1e6
 *
 * @param amount BaseAmount to convert
 * @param decimal Target decimal
 */
export const convertBaseAmountDecimal = (amount: BaseAmount, decimal: number): BaseAmount => {
  const decimalDiff = decimal - amount.decimal

  const amountBN =
    decimalDiff < 0
      ? amount
          .amount()
          .dividedBy(bn(10 ** (decimalDiff * -1)))
          // Never use `BigNumber`s with decimal within `BaseAmount`
          // that's why we need to set `decimalPlaces` to `0`
          // round down is needed to make sure amount of currency is still available
          // without that, `dividedBy` might round up and provide an currency amount which does not exist
          .decimalPlaces(0, BigNumber.ROUND_DOWN)
      : amount.amount().multipliedBy(bn(10 ** decimalDiff))
  return baseAmount(amountBN, decimal)
}

/**
 * Helper to convert a `BaseAmount`
 * into a `BaseAmount` with max. decimal of `1e8`.
 *
 * If decimal of `BaseAmount` is less than `1e8`, it will be unchanged.
 *
 * Examples:
 *
 * 1e12 -> 1e8
 * upTo1e8BaseAmount(baseAmount(123456789012, 12)) // baseAmount(12345678, 8)
 *
 * 1e6 -> 1e6
 * upTo1e8BaseAmount(baseAmount(123456, 6)) // baseAmount(123456, 6)
 */
export const max1e8BaseAmount = (amount: BaseAmount): BaseAmount =>
  amount.decimal <= THORCHAIN_DECIMAL ? amount : convertBaseAmountDecimal(amount, THORCHAIN_DECIMAL)

export const max1e10BaseAmount = (amount: BaseAmount): BaseAmount =>
  amount.decimal <= CACAO_DECIMAL ? amount : convertBaseAmountDecimal(amount, CACAO_DECIMAL)

/**
 * Helper to convert a `BaseAmount`
 * into `1e8` decimal based `BaseAmount`
 */
export const to1e8BaseAmount = (amount: BaseAmount): BaseAmount => convertBaseAmountDecimal(amount, THORCHAIN_DECIMAL)

/**
 * Helper to convert a `AssetAmount`
 * into two sigfig `AssetAmount`
 */
export const getTwoSigfigAssetAmount = (amount: AssetAmount) => {
  const amountIntegerValue = amount.amount().integerValue(BigNumber.ROUND_DOWN)
  const precisionCount = amountIntegerValue.gt(0) ? amountIntegerValue.toString().length + 2 : 2
  return assetAmount(amount.amount().toPrecision(precisionCount))
}

/**
 * Creates an asset from `nullable` string
 */
export const getAssetFromNullableString = (assetString?: string): O.Option<AnyAsset> =>
  FP.pipe(O.fromNullable(assetString), O.map(S.toUpperCase), O.map(assetFromString), O.chain(O.fromNullable))
