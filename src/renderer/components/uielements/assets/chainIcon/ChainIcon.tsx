import React, { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import {
  ADAChain,
  ARBChain,
  AVAXChain,
  BASEChain,
  BCHChain,
  BSCChain,
  BTCChain,
  DASHChain,
  DOGEChain,
  ETHChain,
  GAIAChain,
  LTCChain,
  MAYAChain,
  NEARChain,
  RadixChain,
  SOLChain,
  SUIChain,
  THORChain,
  TRONChain,
  XRPChain,
  ZECChain
} from '../../../../../shared/utils/chainIds'

import { getIntFromName, rainbowStop } from '../../../../helpers/colorHelpers'
import { useRemoteImage } from '../../../../hooks/useRemoteImage'
import {
  arbIcon,
  atomIcon,
  avaxIcon,
  bchIcon,
  bscIcon,
  btcIcon,
  dogeIcon,
  ethIcon,
  ltcIcon,
  runeIcon,
  cacaoIcon,
  dashIcon,
  adaIcon,
  xrdIcon,
  solIcon,
  baseIcon,
  xrpIcon,
  tronIcon,
  suiIcon,
  nearIcon,
  zecIcon
} from '../../../icons'
import { sizes, fontSizes } from './ChainIcon.styles'
import { Size } from './ChainIcon.types'

export type ComponentProps = {
  size?: Size
  chain: string
}

type Props = ComponentProps & React.HTMLAttributes<HTMLDivElement>

const chainIconMap = (chain: string): string => {
  switch (chain) {
    case BTCChain:
      return btcIcon
    case LTCChain:
      return ltcIcon
    case DASHChain:
      return dashIcon
    case XRPChain:
      return xrpIcon
    case ZECChain:
      return zecIcon
    case BCHChain:
      return bchIcon
    case DOGEChain:
      return dogeIcon
    case ADAChain:
      return adaIcon
    case SOLChain:
      return solIcon
    case GAIAChain:
      return atomIcon
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
    case TRONChain:
      return tronIcon
    case THORChain:
      return runeIcon
    case MAYAChain:
      return cacaoIcon
    case RadixChain:
      return xrdIcon
    case SUIChain:
      return suiIcon
    case NEARChain:
      return nearIcon
    default:
      return '' // return null if no chain matches
  }
}

export const ChainIcon = ({ size = 'small', className = '', chain }: Props): JSX.Element => {
  const chainUrl = chainIconMap(chain)

  const remoteIconImage = useRemoteImage(chainUrl)

  const renderIcon = useCallback(
    (src: string) => {
      const iconSize = sizes[size]

      return (
        <div
          className={clsx('relative rounded-full border-transparent bg-cover bg-center', className)}
          style={{
            width: `${sizes[size]}px`,
            height: `${sizes[size]}px`
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
        </div>
      )
    },
    [size, className]
  )
  const renderPendingIcon = useCallback(() => {
    return (
      <div
        className={clsx('relative rounded-full bg-cover bg-center', className)}
        style={{
          width: `${sizes[size]}px`,
          height: `${sizes[size]}px`
        }}>
        <ArrowPathIcon className="h-full w-full text-text0 dark:text-text0d" />
      </div>
    )
  }, [size, className])

  const renderFallbackIcon = useCallback(() => {
    const numbers = getIntFromName(chain)
    const backgroundImage = `linear-gradient(45deg,${rainbowStop(numbers[0])},${rainbowStop(numbers[1])})`
    const iconSize = sizes[size]

    return (
      <div
        className={clsx('relative rounded-full bg-cover bg-center', className)}
        style={{
          width: `${sizes[size]}px`,
          height: `${sizes[size]}px`
        }}>
        <div
          className="top-0 left-0 flex items-center justify-center rounded-full text-text3 dark:text-text3d"
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
  }, [chain, size, className])

  return RD.fold(() => <></>, renderPendingIcon, renderFallbackIcon, renderIcon)(remoteIconImage)
}
