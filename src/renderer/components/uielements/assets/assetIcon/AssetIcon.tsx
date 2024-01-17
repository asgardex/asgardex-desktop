import React, { useMemo, useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BNBChain } from '@xchainjs/xchain-binance'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { Asset, isSynthAsset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { Network } from '../../../../../shared/api/types'
import {
  iconUrlInERC20Whitelist,
  isBchAsset,
  isBnbAsset,
  isBtcAsset,
  isDogeAsset,
  isEthAsset,
  isLtcAsset,
  isRuneNativeAsset,
  isTgtERC20Asset,
  isXRuneAsset,
  isAtomAsset,
  isBnbAssetSynth,
  isBtcAssetSynth,
  isAvaxAsset,
  isBscAsset,
  iconUrlInAVAXERC20Whitelist,
  iconUrlInBSCERC20Whitelist,
  isCacaoAsset,
  isMayaAsset,
  isLtcSynthAsset,
  isEthSynthAsset,
  isAvaxSynthAsset,
  isBscSynthAsset,
  isAtomSynthAsset,
  isDogeSynthAsset,
  isBchSynthAsset
} from '../../../../helpers/assetHelper'
import { isAvaxChain, isBnbChain, isBscChain, isEthChain, isMayaChain } from '../../../../helpers/chainHelper'
import { getIntFromName, rainbowStop } from '../../../../helpers/colorHelpers'
import { useRemoteImage } from '../../../../hooks/useRemoteImage'
import {
  atomIcon,
  avaxIcon,
  bscIcon,
  bnbIcon,
  mayaIcon,
  btcIcon,
  dogeIcon,
  ethIcon,
  runeIcon,
  xRuneIcon,
  tgtIcon,
  cacaoIcon,
  usdpIcon
} from '../../../icons'
import * as Styled from './AssetIcon.styles'
import { Size } from './AssetIcon.types'

export type ComponentProps = {
  size?: Size
  asset: Asset
  network: Network
}

type Props = ComponentProps & React.HTMLAttributes<HTMLDivElement>

const chainIconMap = (asset: Asset): string | null => {
  switch (asset.chain) {
    case ETHChain:
      return ethIcon
    case AVAXChain:
      return avaxIcon
    case BSCChain:
      return bscIcon
    case BNBChain:
      return bnbIcon
    default:
      return null // return null if no chain matches
  }
}

export const AssetIcon: React.FC<Props> = ({ asset, size = 'small', className = '', network }): JSX.Element => {
  const imgUrl = useMemo(() => {
    // BTC
    if (isBtcAsset(asset) || isBtcAssetSynth(asset)) {
      return btcIcon
    }
    // ETH
    if (isEthAsset(asset)) {
      return ethIcon
    }
    // ETH synth
    if (isEthSynthAsset(asset)) {
      return ethIcon
    }
    // AVAX
    if (isAvaxAsset(asset) || isAvaxSynthAsset(asset)) {
      return avaxIcon
    }
    // AVAX
    if (isBscAsset(asset) || isBscSynthAsset(asset)) {
      return bscIcon
    }
    // RUNE
    if (isRuneNativeAsset(asset)) {
      return runeIcon
    }
    // Cacao
    if (isCacaoAsset(asset)) {
      return cacaoIcon
    }
    // BNB
    if (isBnbAsset(asset) || isBnbAssetSynth(asset)) {
      // Since BNB is blacklisted at TrustWallet's asset, we have to use "our" own BNB icon
      // (see https://github.com/trustwallet/assets/blob/master/blockchains/binance/denylist.json
      return bnbIcon
    }
    // LTC
    if (isLtcAsset(asset) || isLtcSynthAsset(asset)) {
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/litecoin/info/logo.png`
    }
    // BCH
    if (isBchAsset(asset) || isBchSynthAsset(asset)) {
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoincash/info/logo.png`
    }

    if (isXRuneAsset(asset)) {
      return xRuneIcon
    }

    if (isTgtERC20Asset(asset)) {
      return tgtIcon
    }

    // DOGE
    if (isDogeAsset(asset) || isDogeSynthAsset(asset)) {
      return dogeIcon
    }

    // Atom
    if (isAtomAsset(asset) || isAtomSynthAsset(asset)) {
      return atomIcon
    }
    // Hack for USDP // 1inch doesn't supply
    if (asset.symbol === 'USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1') {
      return usdpIcon
    }

    if (network !== 'testnet') {
      if (isBnbChain(asset.chain)) {
        return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/${asset.symbol}/logo.png`
      }

      // Since we've already checked ETH.ETH before,
      // we know any asset is ERC20 here - no need to run expensive `isEthTokenAsset`
      if (isEthChain(asset.chain)) {
        return FP.pipe(
          // Try to get url from ERC20Whitelist first
          iconUrlInERC20Whitelist(asset),
          O.getOrElse(() => '')
        )
      }
      // Since we've already checked AVAX.AVAX before,
      // we know any asset is ERC20 here - no need to run expensive `isAvaxTokenAsset`
      if (isAvaxChain(asset.chain)) {
        return FP.pipe(
          // Try to get url from ERC20Whitelist first
          iconUrlInAVAXERC20Whitelist(asset),
          O.getOrElse(() => '')
        )
      }
      // Since we've already checked BSC.BNB before,
      // we know any asset is ERC20 here - no need to run expensive `isBscTokenAsset`
      if (isBscChain(asset.chain)) {
        return FP.pipe(
          // Try to get url from ERC20Whitelist first
          iconUrlInBSCERC20Whitelist(asset),
          O.getOrElse(() => '')
        )
      }
      // Since we've already checked BSC.BNB before,
      // we know any asset is ERC20 here - no need to run expensive `isBscTokenAsset`
      if (isMayaChain(asset.chain) && isMayaAsset(asset)) {
        return mayaIcon
      }
    }

    return ''
  }, [asset, network])

  const remoteIconImage = useRemoteImage(imgUrl)

  const isSynth = isSynthAsset(asset)

  const renderIcon = useCallback(
    (src: string) => {
      const overlayIconSrc = chainIconMap(asset)

      return (
        <Styled.IconWrapper size={size} isSynth={isSynth} className={className}>
          <Styled.Icon src={src} isSynth={isSynth} size={size} />
          {overlayIconSrc && asset.chain !== asset.symbol && <Styled.OverlayIcon src={overlayIconSrc} size={size} />}
        </Styled.IconWrapper>
      )
    },
    [size, isSynth, className, asset]
  )
  const renderPendingIcon = useCallback(() => {
    return (
      <Styled.IconWrapper size={size} isSynth={isSynth} className={className}>
        <Styled.LoadingOutlined />
      </Styled.IconWrapper>
    )
  }, [size, isSynth, className])

  const renderFallbackIcon = useCallback(() => {
    const { chain } = asset
    const numbers = getIntFromName(chain)
    const backgroundImage = `linear-gradient(45deg,${rainbowStop(numbers[0])},${rainbowStop(numbers[1])})`

    return (
      <Styled.IconWrapper isSynth={isSynth} size={size} className={className}>
        <Styled.IconFallback isSynth={isSynth} size={size} style={{ backgroundImage }}>
          {chain}
        </Styled.IconFallback>
      </Styled.IconWrapper>
    )
  }, [asset, isSynth, className, size])

  return RD.fold(() => <></>, renderPendingIcon, renderFallbackIcon, renderIcon)(remoteIconImage)
}
