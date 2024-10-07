import React, { useMemo, useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { AnyAsset, isSynthAsset, isTradeAsset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import {
  iconUrlInERC20Whitelist,
  isBchAsset,
  isBtcAsset,
  isDogeAsset,
  isEthAsset,
  isLtcAsset,
  isRuneNativeAsset,
  isTgtERC20Asset,
  isAtomAsset,
  isArbAsset,
  isAvaxAsset,
  isBscAsset,
  iconUrlInAVAXERC20Whitelist,
  iconUrlInBSCERC20Whitelist,
  isCacaoAsset,
  isMayaAsset,
  isDashAsset,
  isKujiAsset,
  isXrdAsset,
  isUskAsset,
  iconUrlInARBERC20Whitelist,
  isAethAsset
} from '../../../../helpers/assetHelper'
import { isArbChain, isAvaxChain, isBscChain, isEthChain, isMayaChain } from '../../../../helpers/chainHelper'
import { getIntFromName, rainbowStop } from '../../../../helpers/colorHelpers'
import { useRemoteImage } from '../../../../hooks/useRemoteImage'
import {
  arbIcon,
  atomIcon,
  avaxIcon,
  bscIcon,
  mayaIcon,
  btcIcon,
  dogeIcon,
  ethIcon,
  runeIcon,
  tgtIcon,
  cacaoIcon,
  usdpIcon,
  dashIcon,
  kujiIcon,
  uskIcon,
  xrdIcon
} from '../../../icons'
import * as Styled from './AssetIcon.styles'
import { Size } from './AssetIcon.types'

export type ComponentProps = {
  size?: Size
  asset: AnyAsset
  network: Network
}

type Props = ComponentProps & React.HTMLAttributes<HTMLDivElement>

const chainIconMap = (asset: AnyAsset): string | null => {
  switch (asset.chain) {
    case ARBChain:
      return arbIcon
    case ETHChain:
      return ethIcon
    case AVAXChain:
      return avaxIcon
    case BSCChain:
      return bscIcon
    default:
      return null // return null if no chain matches
  }
}

export const AssetIcon: React.FC<Props> = ({ asset, size = 'small', className = '', network }): JSX.Element => {
  const imgUrl = useMemo(() => {
    // BTC
    if (isBtcAsset(asset)) {
      return btcIcon
    }
    // ETH || AETH
    if (isEthAsset(asset) || isAethAsset(asset)) {
      return ethIcon
    }
    // ARB
    if (isArbAsset(asset)) {
      return arbIcon
    }
    // AVAX
    if (isAvaxAsset(asset)) {
      return avaxIcon
    }
    // BSC
    if (isBscAsset(asset)) {
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
    // Dash
    if (isDashAsset(asset)) {
      return dashIcon
    }
    // LTC
    if (isLtcAsset(asset)) {
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/litecoin/info/logo.png`
    }
    // BCH
    if (isBchAsset(asset)) {
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoincash/info/logo.png`
    }

    if (isTgtERC20Asset(asset)) {
      return tgtIcon
    }

    // DOGE
    if (isDogeAsset(asset)) {
      return dogeIcon
    }

    // KUJI
    if (isKujiAsset(asset)) {
      return kujiIcon
    }
    // XRD
    if (isXrdAsset(asset)) {
      return xrdIcon
    }
    // USK
    if (isUskAsset(asset)) {
      return uskIcon
    }

    // Atom
    if (isAtomAsset(asset)) {
      return atomIcon
    }
    // Hack for USDP // 1inch doesn't supply
    if (asset.symbol === 'USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1') {
      return usdpIcon
    }

    if (network !== Network.Testnet) {
      // Since we've already checked ETH.ETH before,
      // we know any asset is ERC20 here - no need to run expensive `isEthTokenAsset`
      if (isEthChain(asset.chain)) {
        return FP.pipe(
          // Try to get url from ERC20Whitelist first
          iconUrlInERC20Whitelist(asset),
          O.getOrElse(() => '')
        )
      }
      // Since we've already checked ARB.ETH before,
      // we know any asset is ERC20 here - no need to run expensive `isArbTokenAsset`
      if (isArbChain(asset.chain)) {
        return FP.pipe(
          // Try to get url from ERC20Whitelist first
          iconUrlInARBERC20Whitelist(asset),
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
  const isTrade = isTradeAsset(asset)

  const renderIcon = useCallback(
    (src: string) => {
      const overlayIconSrc = chainIconMap(asset)

      return (
        <Styled.IconWrapper size={size} isSynth={isSynth} isTrade={isTrade} className={className}>
          <Styled.Icon src={src} isNotNative={isSynth || isTrade} size={size} />
          {overlayIconSrc && !asset.symbol.includes(asset.chain) && (
            <Styled.OverlayIcon src={overlayIconSrc} size={size} />
          )}
        </Styled.IconWrapper>
      )
    },
    [asset, size, isSynth, className, isTrade]
  )
  const renderPendingIcon = useCallback(() => {
    return (
      <Styled.IconWrapper size={size} isNotNative={isSynth || isTrade} className={className}>
        <Styled.LoadingOutlined />
      </Styled.IconWrapper>
    )
  }, [size, isSynth, isTrade, className])

  const renderFallbackIcon = useCallback(() => {
    const { chain } = asset
    const numbers = getIntFromName(chain)
    const backgroundImage = `linear-gradient(45deg,${rainbowStop(numbers[0])},${rainbowStop(numbers[1])})`

    return (
      <Styled.IconWrapper isNotNative={isSynth || isTrade} size={size} className={className}>
        <Styled.IconFallback isNotNative={isSynth || isTrade} size={size} style={{ backgroundImage }}>
          {chain}
        </Styled.IconFallback>
      </Styled.IconWrapper>
    )
  }, [asset, isSynth, isTrade, size, className])

  return RD.fold(() => <></>, renderPendingIcon, renderFallbackIcon, renderIcon)(remoteIconImage)
}
