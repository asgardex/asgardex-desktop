import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { assetAmount, AssetType, baseAmount, TokenAsset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { ETHAddress } from '../../shared/ethereum/const'
import { ERC20_TESTNET } from '../../shared/mock/assets'
import { AssetATOM, AssetBCH, AssetBSC, AssetBTC, AssetETH, AssetLTC, AssetRuneNative } from '../../shared/utils/asset'
import {
  AssetUniH,
  AssetUniHAddress,
  AssetUSDCAVAX,
  AssetUSDCBSC,
  AssetUSDTERC20,
  AssetUSDTERC20Testnet,
  AssetXRune,
  AssetXRuneAddress,
  AssetXRuneTestnet
} from '../const'
import {
  isBchAsset,
  isBtcAsset,
  isChainAsset,
  isEthTokenAsset,
  isEthAsset,
  isLtcAsset,
  isPricePoolAsset,
  isRuneNativeAsset,
  getEthAssetAddress,
  midgardAssetFromString,
  updateEthChecksumAddress,
  convertBaseAmountDecimal,
  isUSDAsset,
  max1e8BaseAmount,
  to1e8BaseAmount,
  getTwoSigfigAssetAmount,
  assetInERC20Whitelist,
  addressInERC20Whitelist,
  validAssetForETH,
  iconUrlInERC20Whitelist,
  isRuneAsset,
  getAssetFromNullableString,
  assetInList,
  isBscAsset
} from './assetHelper'
import { eqAsset, eqAssetAmount, eqBaseAmount, eqOAsset } from './fp/eq'

describe('helpers/assetHelper', () => {
  describe('isRuneNativeAsset', () => {
    it('checks rune native asset', () => {
      expect(isRuneNativeAsset(AssetRuneNative)).toBeTruthy()
    })

    it('returns false for any other asset than RUNE', () => {
      expect(isRuneNativeAsset(AssetBTC)).toBeFalsy()
    })
  })

  describe('isRuneAsset', () => {
    it('AssetRuneNative', () => {
      expect(isRuneAsset(AssetRuneNative)).toBeTruthy()
      expect(isRuneAsset(AssetRuneNative)).toBeTruthy()
    })
    it('AssetBTC', () => {
      expect(isRuneAsset(AssetBTC)).toBeFalsy()
      expect(isRuneAsset(AssetBTC)).toBeFalsy()
    })
  })

  describe('isBscbAsset', () => {
    it('checks Bsc asset', () => {
      expect(isBscAsset(AssetBSC)).toBeTruthy()
    })
  })

  describe('isLtcAsset', () => {
    it('checks LTC asset', () => {
      expect(isLtcAsset(AssetLTC)).toBeTruthy()
    })

    it('returns false for any other asset than LTC', () => {
      expect(isLtcAsset(AssetBTC)).toBeFalsy()
    })
  })

  describe('isBchAsset', () => {
    it('checks BCH asset', () => {
      expect(isBchAsset(AssetBCH)).toBeTruthy()
    })

    it('returns false for any other asset than BCH', () => {
      expect(isBchAsset(AssetBTC)).toBeFalsy()
    })
  })

  describe('isBtcAsset', () => {
    it('checks BTC asset', () => {
      expect(isBtcAsset(AssetBTC)).toBeTruthy()
    })
  })

  describe('isEthAsset', () => {
    it('checks ETH asset', () => {
      expect(isEthAsset(AssetETH)).toBeTruthy()
    })
  })

  describe('isEthTokenAsset', () => {
    it('is true for ETH.USDT ', () => {
      expect(isEthTokenAsset(ERC20_TESTNET.USDT as TokenAsset)).toBeTruthy()
    })
  })

  describe('getEthAssetAddress', () => {
    it('returns ETH address', () => {
      expect(getEthAssetAddress(AssetETH)).toEqual(O.some(ETHAddress))
    })
    it('returns ETH.USDT', () => {
      expect(getEthAssetAddress(ERC20_TESTNET.USDT)).toEqual(O.some('0xDB99328b43B86037f80B43c3DbD203F00F056B75'))
    })
    it('is returns None for non ETH assets', () => {
      expect(getEthAssetAddress(AssetRuneNative)).toBeNone()
    })
  })

  describe('assetInERC20Whitelist', () => {
    it('UNIH (black listed)', () => {
      expect(assetInERC20Whitelist(AssetUniH)).toBeFalsy()
    })

    it('USDT (white listed)', () => {
      expect(assetInERC20Whitelist(AssetUSDTERC20)).toBeTruthy()
    })

    it('XRUNE (white listed)', () => {
      expect(assetInERC20Whitelist(AssetXRune)).toBeTruthy()
    })
  })

  describe('iconUrlInERC20Whitelist', () => {
    it('USDT (w/ icon)', () => {
      expect(iconUrlInERC20Whitelist(AssetUSDTERC20)).toEqual(
        O.some('https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png')
      )
    })

    it('XRUNE (w/ icon)', () => {
      expect(iconUrlInERC20Whitelist(AssetXRune)).toEqual(
        O.some('https://assets.coingecko.com/coins/images/16835/small/thorstarter.jpg')
      )
    })

    it('VIU (w/o icon)', () => {
      expect(
        iconUrlInERC20Whitelist({
          chain: ETHChain,
          symbol: 'VIU-0x519475b31653E46D20cD09F9FdcF3B12BDAcB4f5',
          ticker: 'VIU',
          type: AssetType.TOKEN
        })
      ).toBeNone()
    })
  })

  describe('addressInERC20Whitelist', () => {
    it('USDT (whitelisted)', () => {
      expect(addressInERC20Whitelist('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBeTruthy()
    })
    it('XRUNE (whitelisted)', () => {
      expect(addressInERC20Whitelist(AssetXRuneAddress)).toBeTruthy()
    })
    it('UNIH (not whitelisted)', () => {
      expect(addressInERC20Whitelist(AssetUniHAddress)).toBeFalsy()
    })
  })

  describe('validAssetForETH', () => {
    it('ETH - mainnet', () => {
      expect(validAssetForETH(AssetETH, Network.Mainnet)).toBeTruthy()
    })
    it('ETH - testnet', () => {
      expect(validAssetForETH(AssetETH, Network.Testnet)).toBeTruthy()
    })
    it('XRUNE - mainnet', () => {
      expect(validAssetForETH(AssetXRune, Network.Mainnet)).toBeTruthy()
    })
    it('XRUNE - testnet', () => {
      expect(validAssetForETH(AssetXRune, Network.Testnet)).toBeTruthy()
    })
    it('XRUNTestnet - mainnet', () => {
      expect(validAssetForETH(AssetXRuneTestnet, Network.Mainnet)).toBeFalsy()
    })
    it('XRUNTestnet - testnet', () => {
      expect(validAssetForETH(AssetXRuneTestnet, Network.Testnet)).toBeTruthy()
    })
    it('UNIH - mainnet', () => {
      expect(validAssetForETH(AssetUniH, Network.Mainnet)).toBeFalsy()
    })
  })

  describe('assetInList', () => {
    const list = [AssetBSC, AssetBTC, AssetRuneNative]

    it('AssetBSC', () => {
      expect(FP.pipe(list, assetInList(AssetBSC))).toBeTruthy()
    })
    it('AssetBTC', () => {
      expect(FP.pipe(list, assetInList(AssetBTC))).toBeTruthy()
    })
    it('AssetETH', () => {
      expect(FP.pipe(list, assetInList(AssetETH))).toBeFalsy()
    })
  })

  describe('isPricePoolAsset', () => {
    it('returns true for USDC', () => {
      expect(isPricePoolAsset(AssetUSDCAVAX)).toBeTruthy()
      expect(isPricePoolAsset(AssetUSDCBSC)).toBeTruthy()
    })
    it('returns false for BTC', () => {
      expect(isPricePoolAsset(AssetBSC)).toBeFalsy()
    })
    it('returns false for deprecated asset ', () => {
      expect(
        isPricePoolAsset({ chain: BSCChain, symbol: 'RUNE-1AF', ticker: 'RUNE', type: AssetType.TOKEN })
      ).toBeFalsy()
    })
  })

  describe('isChainAsset', () => {
    it('RUNE Native ', () => {
      expect(isChainAsset(AssetRuneNative)).toBeTruthy()
    })
    it('ATOM', () => {
      expect(isChainAsset(AssetATOM)).toBeTruthy()
    })
    it('BSC', () => {
      expect(isChainAsset(AssetBSC)).toBeTruthy()
    })
    it('BSC.USDC', () => {
      expect(isChainAsset(AssetUSDCBSC)).toBeFalsy()
    })
  })

  describe('isUSDAsset', () => {
    it('USDC (BSC) -> true', () => {
      expect(isUSDAsset(AssetUSDCBSC)).toBeTruthy()
    })
    it('USDT (ERC20) -> true', () => {
      expect(isUSDAsset(AssetUSDTERC20Testnet)).toBeTruthy()
    })

    it('RUNE Native -> false', () => {
      expect(isUSDAsset(AssetRuneNative)).toBeFalsy()
    })
  })

  describe('midgardAssetFromString', () => {
    it('returns AssetETH for ETH asset string', () => {
      const asset = midgardAssetFromString('ETH.ETH')
      expect(asset).toEqual(O.some(AssetETH))
    })
    it('returns AssetUSDTERC20 for ERC20 USDT asset string ', () => {
      const asset = midgardAssetFromString('ETH.USDT-0x62e273709da575835c7f6aef4a31140ca5b1d190')
      expect(asset).toEqual(
        O.some({ ...AssetUSDTERC20Testnet, symbol: 'USDT-0x62e273709Da575835C7f6aEf4A31140Ca5b1D190' })
      )
    })
    it('returns O.none for invalid asset strings', () => {
      const asset = midgardAssetFromString('invalid')
      expect(asset).toEqual(O.none)
    })
  })

  describe('updateEthChecksumAddress', () => {
    it('does not update AssetETH ', () => {
      const asset = updateEthChecksumAddress(AssetETH)
      expect(eqAsset.equals(asset, AssetETH)).toBeTruthy()
    })
    it('updates invalid ERC20 USDT ', () => {
      const asset = updateEthChecksumAddress({
        ...AssetUSDTERC20Testnet,
        symbol: 'USDT-0xA3910454BF2CB59B8B3A401589A3BACC5CA42306'
      })
      expect(eqAsset.equals(asset, AssetUSDTERC20Testnet)).toBeTruthy()
    })
  })

  describe('convertBaseAmountDecimal', () => {
    it('converts 1e8 decimal to 1e12', () => {
      const result = convertBaseAmountDecimal(baseAmount('12345678', 8), 12)
      expect(eqBaseAmount.equals(result, baseAmount('123456780000', 12))).toBeTruthy()
    })
    it('converts 1e8 decimal to 1e18 (part 1)', () => {
      const result = convertBaseAmountDecimal(baseAmount('739', 8), 18)
      expect(eqBaseAmount.equals(result, baseAmount('7390000000000', 18))).toBeTruthy()
    })
    it('converts 1e8 decimal to 1e18 (part 2)', () => {
      const result = convertBaseAmountDecimal(baseAmount('7481127', 8), 18)
      expect(eqBaseAmount.equals(result, baseAmount('74811270000000000', 18))).toBeTruthy()
    })
    it('converts 1e8 decimal to 1e6 ', () => {
      const result = convertBaseAmountDecimal(baseAmount('12345678', 8), 6)
      expect(eqBaseAmount.equals(result, baseAmount('123456', 6))).toBeTruthy()
    })
    it('converts 1e18 decimal to 1e8', () => {
      const result = convertBaseAmountDecimal(baseAmount('123456789012345678', 18), 8)
      expect(eqBaseAmount.equals(result, baseAmount('12345678', 8))).toBeTruthy()
    })
    it('does not convert anything by using same decimals', () => {
      const amount = baseAmount('123456', 6)
      const result = convertBaseAmountDecimal(amount, 6)
      expect(eqBaseAmount.equals(result, amount)).toBeTruthy()
    })
  })

  describe('max1e8BaseAmount', () => {
    it('converts 1e12 to 1e8', () => {
      const result = max1e8BaseAmount(baseAmount('123456789012', 12))
      expect(eqBaseAmount.equals(result, baseAmount('12345678', 8))).toBeTruthy()
    })
    it('keeps 1e6 unchanged', () => {
      const result = max1e8BaseAmount(baseAmount('123456', 6))
      expect(eqBaseAmount.equals(result, baseAmount('123456', 6))).toBeTruthy()
    })
  })

  describe('to1e8BaseAmount', () => {
    it('converts 1e12 to 1e8', () => {
      const result = to1e8BaseAmount(baseAmount('123456789012', 12))
      expect(eqBaseAmount.equals(result, baseAmount('12345678', 8))).toBeTruthy()
    })
    it('converts 1e6 to 1e8', () => {
      const result = to1e8BaseAmount(baseAmount('123456', 6))
      expect(eqBaseAmount.equals(result, baseAmount('12345600', 8))).toBeTruthy()
    })
    it('keeps 1e8 unchanged', () => {
      const result = to1e8BaseAmount(baseAmount('12345678', 8))
      expect(eqBaseAmount.equals(result, baseAmount('12345678', 8))).toBeTruthy()
    })
  })

  describe('getTwoSigfigAssetAmount', () => {
    it('returns two decimal amount in case the value is bigger than 1', () => {
      const result = getTwoSigfigAssetAmount(assetAmount('12.234'))
      expect(eqAssetAmount.equals(result, assetAmount('12.23'))).toBeTruthy()
    })
    it('returns two sigfig amount in case the value is less than 1', () => {
      const result = getTwoSigfigAssetAmount(assetAmount('0.0123'))
      expect(eqAssetAmount.equals(result, assetAmount('0.012'))).toBeTruthy()
    })
  })

  describe('getAssetFromNullableString', () => {
    it('BSC.BSC (uppercase)', () => {
      const result = getAssetFromNullableString('BSC.BNB')
      expect(eqOAsset.equals(result, O.some(AssetBSC))).toBeTruthy()
    })
    it('bsc.bnb (lowercase)', () => {
      const result = getAssetFromNullableString('bsc.bnb')
      expect(eqOAsset.equals(result, O.some(AssetBSC))).toBeTruthy()
    })
    it('invalid', () => {
      const result = getAssetFromNullableString('invalid')
      expect(result).toBeNone()
    })
    it('BSC (no ticker)', () => {
      const result = getAssetFromNullableString('BSC')
      expect(result).toBeNone()
    })
    it('undefined', () => {
      const result = getAssetFromNullableString()
      expect(result).toBeNone()
    })
    it('empty string', () => {
      const result = getAssetFromNullableString('')
      expect(result).toBeNone()
    })
  })
})
