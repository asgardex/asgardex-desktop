import { AssetAETH, AssetARB } from '@xchainjs/xchain-arbitrum'
import { Network } from '@xchainjs/xchain-client'
import { AssetDASH } from '@xchainjs/xchain-dash'
import { getTokenAddress } from '@xchainjs/xchain-evm'
import { AssetUSK } from '@xchainjs/xchain-kujira'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import {
  Address,
  Asset,
  assetAmount,
  AssetAmount,
  assetFromString,
  baseAmount,
  BaseAmount,
  bn
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as P from 'fp-ts/lib/Predicate'
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
  AssetSynthBtc,
  AssetSynthEth,
  AssetCacao,
  AssetMaya,
  AssetSynthLTC,
  AssetSynthARB,
  AssetSynthAVAX,
  AssetSynthBSC,
  AssetSynthDOGE,
  AssetSynthATOM,
  AssetSynthBCH,
  AssetSynthAVAXUSDC,
  AssetSynthEthUsdc,
  AssetSynthEthUsdt,
  AssetKUJI,
  AssetSynthKuji,
  AssetSynthUsk,
  AssetSynthDash
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

export const isAssetInMayachainPools = (asset: Asset): boolean =>
  eqAsset.equals(asset, AssetCacao || AssetDASH || AssetKUJI)

/**
 * Checks whether an asset is an RuneNative asset
 */
export const isRuneNativeAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetRuneNative)

/**
 * Checks whether an asset is a Rune (native or non-native) asset
 */
export const isRuneAsset = (asset: Asset): boolean => isRuneNativeAsset(asset)

/**
 * Checks whether an asset is a LTC asset
 */
export const isLtcAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetLTC)

/**
 * Checks whether an asset is a LTC asset
 */
export const isLtcSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthLTC)

/**
 * Checks whether an asset is a BCH asset
 */
export const isBchAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetBCH)

/**
 * Checks whether an asset is a Dash asset
 */
export const isDashAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetDASH)

/**
 * Checks whether an asset is a Dash asset
 */
export const isDashSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthDash)

/**
 * Checks whether an asset is a BCH synth asset
 */
export const isBchSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthBCH)

/**
 * Checks whether an asset is a Cacao asset
 */
export const isCacaoAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetCacao)

/**
 * Checks whether an asset is a Maya asset
 */
export const isMayaAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetMaya)

/**
 * Checks whether an asset is a BTC asset
 */
export const isBtcAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetBTC)

/**
 * Checks whether an asset is a Btc synthetic asset
 */
export const isBtcAssetSynth = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthBtc)

/**
 * Checks whether an asset is an ETH asset
 */
export const isEthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetETH)

/**
 * Checks whether an asset is an ARB asset
 */
export const isArbAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetARB)

/**
 * Checks whether an asset is an ARB ETH asset
 */
export const isAethAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetAETH)
/**
 * Checks whether an asset is an ARB synth asset
 */
export const isArbSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthARB)

/**
 * Checks whether an asset is an AVAX asset
 */
export const isAvaxAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetAVAX)
/**
 * Checks whether an asset is an AVAX synth asset
 */
export const isAvaxSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthAVAX || AssetSynthAVAXUSDC)

/**
 * Checks whether an asset is an BSC asset
 */
export const isBscAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetBSC)
/**
 * Checks whether an asset is an BSC synth asset
 */
export const isBscSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthBSC)

/**
 * Checks whether an asset is an ETH synthetic
 */
export const isEthSynthAsset = (asset: Asset): boolean => {
  const normalizedInputAsset = {
    ...asset,
    chain: asset.chain.toUpperCase(),
    symbol: asset.symbol.toUpperCase(),
    ticker: asset.ticker.toUpperCase()
  }

  return eqAsset.equals(normalizedInputAsset, AssetSynthEth)
}

/**
 * Checks whether an asset is an ETH synthetic
 */
export const isEthSynthUSDCAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthEthUsdc)

export const isEthSynthUSDTAsset = (asset: Asset): boolean => {
  const normalizedInputAsset = {
    ...asset,
    chain: asset.chain.toUpperCase(),
    symbol: asset.symbol.toUpperCase(),
    ticker: asset.ticker.toUpperCase()
  }
  return eqAsset.equals(normalizedInputAsset, AssetSynthEthUsdt)
}

/**
 * Checks whether an asset is a DOGE asset
 */
export const isDogeAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetDOGE)
/**
 * Checks whether an asset is a DOGE asset
 */
export const isKujiAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetKUJI)

export const isUskAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetUSK)
/**
 * Checks whether an asset is a DOGE synth asset
 */
export const isDogeSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthDOGE)

/**
 * Checks whether an asset is a Kuji synth asset
 */
export const isKujiSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthKuji)

/**
 * Checks whether an asset is a USK synth asset
 */
export const isUskSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthUsk)
/**
 * Checks whether an asset is a ATOM asset
 */
export const isAtomAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetATOM)

/**
 * Checks whether an asset is a ATOM synth asset
 */
export const isAtomSynthAsset = (asset: Asset): boolean => eqAsset.equals(asset, AssetSynthATOM)

/**
 * Check whether an asset is in a list
 */
export const assetInList =
  (asset: Asset) =>
  (list: Asset[]): boolean =>
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
export const assetInERC20Whitelist = (asset: Asset): boolean =>
  FP.pipe(
    ERC20_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInERC20Whitelist = (asset: Asset): O.Option<string> =>
  FP.pipe(
    ERC20_WHITELIST,
    A.findFirst(({ asset: assetInList }) => assetInList.symbol.toUpperCase() === asset.symbol.toUpperCase()),
    O.chain(({ iconUrl }) => iconUrl)
  )
/**
 * Checks whether an ERC20 asset is white listed or not
 */
export const assetInARBERC20Whitelist = (asset: Asset): boolean =>
  FP.pipe(
    ARB_TOKEN_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInARBERC20Whitelist = (asset: Asset): O.Option<string> =>
  FP.pipe(
    ARB_TOKEN_WHITELIST,
    A.findFirst(({ asset: assetInList }) => assetInList.symbol.toUpperCase() === asset.symbol.toUpperCase()),
    O.chain(({ iconUrl }) => iconUrl)
  )

/**
 * Checks whether an ERC20 asset is white listed or not
 */
export const assetInAVAXERC20Whitelist = (asset: Asset): boolean =>
  FP.pipe(
    AVAX_TOKEN_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInAVAXERC20Whitelist = (asset: Asset): O.Option<string> =>
  FP.pipe(
    AVAX_TOKEN_WHITELIST,
    A.findFirst(({ asset: assetInList }) => assetInList.symbol.toUpperCase() === asset.symbol.toUpperCase()),
    O.chain(({ iconUrl }) => iconUrl)
  )

/**
 * Checks whether an ERC20 asset is white listed or not
 */
export const assetInBSCERC20Whitelist = (asset: Asset): boolean =>
  FP.pipe(
    BSC_TOKEN_WHITELIST,
    A.map(({ asset }) => asset),
    assetInList(asset)
  )

/**
 * Get's icon url from white list
 */
export const iconUrlInBSCERC20Whitelist = (asset: Asset): O.Option<string> =>
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
export const validAssetForETH = (asset: Asset /* ETH or ERC20 asset */, network: Network): boolean =>
  network !== Network.Mainnet /* (1) */ || isEthAsset(asset) /* (2) */ || assetInERC20Whitelist(asset)

/**
 * Checks whether ETH/ERC20 asset is whitelisted or not
 * based on following rules:
 * (1) Check on `mainnet` only
 * (2) Always accept ETH
 * (3) ERC20 asset needs to be listed in `ARBERC20Whitelist`
 */
export const validAssetForARB = (asset: Asset /* ETH or ERC20 asset */, network: Network): boolean =>
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
export const validAssetForAVAX = (asset: Asset /* AVAX or ERC20 asset */, network: Network): boolean =>
  network !== Network.Mainnet /* (1) */ || isAvaxAsset(asset) /* (2) */ || assetInAVAXERC20Whitelist(asset)

/**
 * Checks whether BSC/ERC20 asset is whitelisted or not
 * based on following rules:
 * (1) Check on `mainnet` only
 * (2) Always accept BSC
 * (3) ERC20 asset needs to be listed in `ERC20Whitelist`
 * BSC-USD is corrupted. Temporary fix until xchainjs fixes the issue
 */
export const validAssetForBSC = (asset: Asset /* BSC or ERC20 asset */, network: Network): boolean => {
  return network !== Network.Mainnet || isBscAsset(asset) || assetInBSCERC20Whitelist(asset) // Check additional conditions
}

/**
 * Checks whether an ERC20 address is black listed or not
 */
const addressInList = (address: Address, list: Asset[]): boolean => {
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
export const isTgtERC20Asset = (asset: Asset): boolean => eqAsset.equals(asset, AssetTGTERC20)

/**
 * Get ethereum token address (as check sum address) from a given asset
 */
export const getEthTokenAddress: (asset: Asset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getEthChecksumAddress)
)

/**
 * Get arb token address (as check sum address) from a given asset
 */
export const getArbTokenAddress: (asset: Asset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getArbChecksumAddress)
)

/**
 * Get avax token address (as check sum address) from a given asset
 */
export const getAvaxTokenAddress: (asset: Asset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getAvaxChecksumAddress)
)

/**
 * Get Bsc token address (as check sum address) from a given asset
 */
export const getBscTokenAddress: (asset: Asset) => O.Option<Address> = FP.flow(
  getTokenAddress,
  O.fromNullable,
  O.chain(getBscChecksumAddress)
)

/**
 * Get address (as check sum address) from an ETH or ETH token asset
 */
export const getEthAssetAddress = (asset: Asset): O.Option<Address> =>
  isEthAsset(asset) ? O.some(ETHAddress) : getEthTokenAddress(asset)

/**
 * Get address (as check sum address) from an Arb or Arb token asset
 */
export const getArbAssetAddress = (asset: Asset): O.Option<Address> =>
  isAethAsset(asset) ? O.some(ArbZeroAddress) : getArbTokenAddress(asset)

/**
 * Get address (as check sum address) from an Avax or Avax token asset
 */
export const getAvaxAssetAddress = (asset: Asset): O.Option<Address> =>
  isAvaxAsset(asset) ? O.some(AvaxZeroAddress) : getAvaxTokenAddress(asset)

/**
 * Get address (as check sum address) from an Bsc or Bsc token asset
 */
export const getBscAssetAddress = (asset: Asset): O.Option<Address> =>
  isBscAsset(asset) ? O.some(BscZeroAddress) : getBscTokenAddress(asset)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isEthTokenAsset: (asset: Asset) => boolean = FP.flow(getEthTokenAddress, O.isSome)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isArbTokenAsset: (asset: Asset) => boolean = FP.flow(getArbTokenAddress, O.isSome)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isAvaxTokenAsset: (asset: Asset) => boolean = FP.flow(getAvaxTokenAddress, O.isSome)

/**
 * Check whether an asset is an ERC20 asset
 */
export const isBscTokenAsset: (asset: Asset) => boolean = FP.flow(getBscTokenAddress, O.isSome)

// Type guard for `PricePoolAsset`
export const isPricePoolAsset = (asset: Asset): asset is PricePoolAsset =>
  // all of PoolAsset except BSC.BNB -> see `PricePoolAsset`
  [...DEFAULT_PRICE_ASSETS, ...USD_PRICE_ASSETS].includes(asset)

// How should this work for synths tobefixed
export const isChainAsset = (asset: Asset): boolean =>
  isSupportedChain(asset.chain) && eqAsset.equals(asset, getChainAsset(asset.chain))

export const isUSDAsset = ({ ticker }: Asset): boolean =>
  ticker.includes('USD') || ticker.includes('UST') || ticker.includes('DAI') || ticker.includes('usdt')

export const isUtxoAssetChain = ({ chain }: Asset) =>
  isBtcChain(chain) || isBchChain(chain) || isLtcChain(chain) || isDogeChain(chain)

/**
 * Update ETH token (ERC20) addresses to be based on checksum addresses
 * Other assets then ETH tokens (ERC20) won't be updated and will be returned w/o any changes
 */
export const updateEthChecksumAddress = (asset: Asset): Asset =>
  FP.pipe(
    asset,
    // ETH chain only
    O.fromPredicate(({ chain }) => isEthChain(chain)),
    // ETH asset only
    O.chain(O.fromPredicate(P.not(isEthAsset))),
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
export const midgardAssetFromString: (assetString: string) => O.Option<Asset> = FP.flow(
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
export const getAssetFromNullableString = (assetString?: string): O.Option<Asset> =>
  FP.pipe(O.fromNullable(assetString), O.map(S.toUpperCase), O.map(assetFromString), O.chain(O.fromNullable))
