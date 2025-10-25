import React, { useMemo, useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/20/solid'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { SOLChain } from '@xchainjs/xchain-solana'
import { isTCYAsset, THORChain } from '@xchainjs/xchain-thorchain'
import { TRONChain } from '@xchainjs/xchain-tron'
import { AnyAsset, AssetType, isSecuredAsset, isSynthAsset, isTradeAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'

import { AssetSOLUSDC } from '../../../../const'
import {
  iconUrlInERC20Whitelist,
  isBchAsset,
  isBtcAsset,
  isDogeAsset,
  isEthAsset,
  isLtcAsset,
  isRuneAsset,
  isTgtERC20Asset,
  isAtomAsset,
  isArbAsset,
  isAvaxAsset,
  isBscAsset,
  iconUrlInAVAXERC20Whitelist,
  iconUrlInBSCERC20Whitelist,
  isCacaoAsset,
  isRujiAsset,
  isMayaAsset,
  isDashAsset,
  isKujiAsset,
  isXrdAsset,
  isZecAsset,
  isUskAsset,
  iconUrlInARBERC20Whitelist,
  isAethAsset,
  isSolAsset,
  isBaseAsset,
  iconUrlInBASEERC20Whitelist,
  isAdaAsset,
  isXrpAsset,
  isTrxAsset,
  iconUrlInTRONTRC20Whitelist
} from '../../../../helpers/assetHelper'
import {
  isArbChain,
  isAvaxChain,
  isBaseChain,
  isBscChain,
  isEthChain,
  isMayaChain,
  isSolChain,
  isTronChain
} from '../../../../helpers/chainHelper'
import { getIntFromName, rainbowStop } from '../../../../helpers/colorHelpers'
import { useRemoteImage } from '../../../../hooks/useRemoteImage'
import {
  arbIcon,
  atomIcon,
  avaxIcon,
  bchIcon,
  bscIcon,
  mayaIcon,
  btcIcon,
  dogeIcon,
  ethIcon,
  ltcIcon,
  runeIcon,
  tgtIcon,
  cacaoIcon,
  usdpIcon,
  dashIcon,
  kujiIcon,
  adaIcon,
  uskIcon,
  xrdIcon,
  solIcon,
  baseIcon,
  tcyIcon,
  xrpIcon,
  rujiIcon,
  tronIcon,
  zecIcon
} from '../../../icons'
import { sizes, borders, fontSizes } from './AssetIcon.styles'
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
    case BASEChain:
      return baseIcon
    case BSCChain:
      return bscIcon
    case SOLChain:
      return solIcon
    case TRONChain:
      return tronIcon
    case THORChain:
      if (asset.type === AssetType.NATIVE || asset.type === AssetType.TRADE) return null
      return runeIcon
    default:
      return null // return null if no chain matches
  }
}

export const AssetIcon = ({ asset, size = 'small', className = '', network }: Props): JSX.Element => {
  const imgUrl = useMemo(() => {
    // BTC
    if (isBtcAsset(asset)) {
      return btcIcon
    }
    // ETH || ARETH || BETH
    if (isEthAsset(asset) || isAethAsset(asset) || isBaseAsset(asset)) {
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
    if (isRuneAsset(asset)) {
      return runeIcon
    }
    // RUJI
    if (isRujiAsset(asset)) {
      return rujiIcon
    }
    // TCY
    if (isTCYAsset(asset)) {
      return tcyIcon
    }
    // Cacao
    if (isCacaoAsset(asset)) {
      return cacaoIcon
    }
    // Dash
    if (isDashAsset(asset)) {
      return dashIcon
    }
    // XRP
    if (isXrpAsset(asset)) {
      return xrpIcon
    }
    // ZEC
    if (isZecAsset(asset)) {
      return zecIcon
    }
    // LTC
    if (isLtcAsset(asset)) {
      return ltcIcon
    }
    // BCH
    if (isBchAsset(asset)) {
      return bchIcon
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
    // ADA
    if (isAdaAsset(asset)) {
      return adaIcon
    }
    // XRD
    if (isXrdAsset(asset)) {
      return xrdIcon
    }
    // Sol
    if (isSolAsset(asset)) {
      return solIcon
    }
    // USK
    if (isUskAsset(asset)) {
      return uskIcon
    }

    // Atom
    if (isAtomAsset(asset)) {
      return atomIcon
    }
    // TRX
    if (isTrxAsset(asset)) {
      return tronIcon
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
      if (isBaseChain(asset.chain)) {
        return FP.pipe(
          // Try to get base url from ERC20Whitelist first
          iconUrlInBASEERC20Whitelist(asset),
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
      // Add a specific check for sol.usdc
      if (isSolChain(asset.chain) && asset.ticker === AssetSOLUSDC.ticker) {
        return 'https://storage.googleapis.com/token-list-swapkit/images/sol.usdc-epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v.png'
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
      // Handle TRON tokens (TRC20)
      if (isTronChain(asset.chain) && asset.type === AssetType.TOKEN) {
        return FP.pipe(
          // Try to get icon url from TRC20 whitelist
          iconUrlInTRONTRC20Whitelist(asset),
          O.getOrElse(() => '')
        )
      }
    }

    return ''
  }, [asset, network])

  const remoteIconImage = useRemoteImage(imgUrl)

  const isSynth = isSynthAsset(asset)
  const isTrade = isTradeAsset(asset)
  const isSecured = isSecuredAsset(asset)

  const renderIcon = useCallback(
    (src: string) => {
      const overlayIconSrc = chainIconMap(asset)
      const hasBorder = isSynth || isTrade || isSecured
      const borderWidth = hasBorder ? borders[size] : 0
      const borderColor = isSynth
        ? 'border-turquoise'
        : isTrade
          ? 'border-turquoise'
          : isSecured
            ? 'border-[#B224EC]'
            : 'border-transparent'
      const shadowClass = isSynth
        ? 'shadow-[0px_0px_15px_5px_rgba(80,227,194,0.8)]'
        : isTrade
          ? 'shadow-[0px_0px_15px_5px_rgba(113,188,247,0.8)]'
          : isSecured
            ? 'shadow-[0px_0px_15px_5px_rgba(178,36,236,0.8)]'
            : ''
      const adjustment = hasBorder ? 2 * borders[size] : 0
      const iconSize = sizes[size] - adjustment
      const overlaySize = sizes[size] * 0.4

      return (
        <div
          className={clsx('relative rounded-full bg-cover bg-center', hasBorder && borderColor, shadowClass, className)}
          style={{
            width: `${sizes[size]}px`,
            height: `${sizes[size]}px`,
            ...(hasBorder && { borderWidth: borderWidth, borderStyle: 'solid' })
          }}>
          <img
            src={src}
            alt=""
            className="max-w-none rounded-full"
            style={{
              width: iconSize,
              height: iconSize
            }}
          />
          {overlayIconSrc && !asset.symbol.includes(asset.chain) && !isTrxAsset(asset) && (
            <img
              src={overlayIconSrc}
              alt=""
              className="absolute bottom-0 right-0 z-[2] rounded-full bg-white/50"
              style={{
                width: `${overlaySize}px`,
                height: `${overlaySize}px`
              }}
            />
          )}
        </div>
      )
    },
    [asset, size, isSynth, isTrade, className, isSecured]
  )
  const renderPendingIcon = useCallback(() => {
    const hasBorder = isSynth || isTrade
    const borderWidth = hasBorder ? borders[size] : 0
    const borderColor = isSynth ? 'border-turquoise' : isTrade ? 'border-turquoise' : ''

    return (
      <div
        className={clsx('relative rounded-full bg-cover bg-center', hasBorder && borderColor, className)}
        style={{
          width: `${sizes[size]}px`,
          height: `${sizes[size]}px`,
          ...(hasBorder && { borderWidth: `${borderWidth}px`, borderStyle: 'solid' })
        }}>
        <ArrowPathIcon className="h-full w-full text-text0 dark:text-text0d" />
      </div>
    )
  }, [size, isSynth, isTrade, className])

  const renderFallbackIcon = useCallback(() => {
    const { chain } = asset
    const numbers = getIntFromName(chain)
    const backgroundImage = `linear-gradient(45deg,${rainbowStop(numbers[0])},${rainbowStop(numbers[1])})`
    const hasBorder = isSynth || isTrade
    const borderWidth = hasBorder ? borders[size] : 0
    const borderColor = isSynth ? 'border-turquoise' : isTrade ? 'border-turquoise' : ''
    const adjustment = hasBorder ? 2 * borders[size] : 0
    const iconSize = sizes[size] - adjustment

    return (
      <div
        className={clsx('relative rounded-full bg-cover bg-center', hasBorder && borderColor, className)}
        style={{
          width: `${sizes[size]}px`,
          height: `${sizes[size]}px`,
          ...(hasBorder && { borderWidth: `${borderWidth}px`, borderStyle: 'solid' })
        }}>
        <div
          className="left-0 top-0 flex items-center justify-center rounded-full text-text3 dark:text-text3d"
          style={{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            fontSize: `${fontSizes[size]}px`,
            backgroundImage
          }}>
          {chain}
        </div>
      </div>
    )
  }, [asset, isSynth, isTrade, size, className])

  return RD.fold(() => <></>, renderPendingIcon, renderFallbackIcon, renderIcon)(remoteIconImage)
}
