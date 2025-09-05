import { useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, array as A, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { useAppContext } from '../../../contexts/AppContext'
import { OnlineStatus } from '../../../services/app/types'
import {
  MidgardStatusRD as MidgardMayaStatusRD,
  MidgardUrlRD as MidgardMayaUrlRD,
  MidgardStatusRD,
  MidgardUrlRD
} from '../../../services/midgard/midgardTypes'
import { MimirRD } from '../../../services/thorchain/types'
import { DownIcon } from '../../icons'
import { ConnectionStatus } from '../../shared/icons'
import { Dropdown } from '../../uielements/dropdown'
import { Label } from '../../uielements/label'
import { headerNetStatusSubheadline, headerNetStatusColor, HeaderNetStatusColor } from '../Header.util'

type MenuItem = {
  key: string
  headline: string
  url: string
  subheadline: string
  color: HeaderNetStatusColor
}

export type Props = {
  isDesktopView: boolean
  midgardStatus: MidgardStatusRD
  midgardMayaStatus: MidgardMayaStatusRD
  mimirStatus: MimirRD
  midgardUrl: MidgardUrlRD
  midgardMayaUrl: MidgardMayaUrlRD
  thorchainNodeUrl: string
  thorchainRpcUrl: string
  mayachainNodeUrl: string
  mayachainRpcUrl: string
}

export const HeaderNetStatus = (props: Props) => {
  const {
    isDesktopView,
    midgardStatus: midgardStatusRD,
    midgardMayaStatus: midgardMayaStatusRD,
    mimirStatus: mimirStatusRD,
    midgardUrl: midgardUrlRD,
    midgardMayaUrl: midgardUrlMayaRD,
    thorchainNodeUrl,
    thorchainRpcUrl,
    mayachainNodeUrl,
    mayachainRpcUrl
  } = props
  const intl = useIntl()

  const prevMidgardStatus = useRef<OnlineStatus>(OnlineStatus.OFF)
  const midgardStatus: OnlineStatus = useMemo(
    () =>
      FP.pipe(
        midgardStatusRD,
        RD.fold(
          () => prevMidgardStatus.current,
          () => prevMidgardStatus.current,
          () => {
            prevMidgardStatus.current = OnlineStatus.OFF
            return prevMidgardStatus.current
          },
          () => {
            prevMidgardStatus.current = OnlineStatus.ON
            return prevMidgardStatus.current
          }
        )
      ),
    [midgardStatusRD]
  )
  const midgardMayaStatus: OnlineStatus = useMemo(
    () =>
      FP.pipe(
        midgardMayaStatusRD,
        RD.fold(
          () => prevMidgardStatus.current,
          () => prevMidgardStatus.current,
          () => {
            prevMidgardStatus.current = OnlineStatus.OFF
            return prevMidgardStatus.current
          },
          () => {
            prevMidgardStatus.current = OnlineStatus.ON
            return prevMidgardStatus.current
          }
        )
      ),
    [midgardMayaStatusRD]
  )

  const prevThorchainStatus = useRef<OnlineStatus>(OnlineStatus.OFF)
  const thorchainStatus: OnlineStatus = useMemo(
    () =>
      FP.pipe(
        mimirStatusRD,
        RD.fold(
          () => prevThorchainStatus.current,
          () => prevThorchainStatus.current,
          () => {
            prevThorchainStatus.current = OnlineStatus.OFF
            return prevThorchainStatus.current
          },
          () => {
            prevThorchainStatus.current = OnlineStatus.ON
            return prevThorchainStatus.current
          }
        )
      ),
    [mimirStatusRD]
  )
  const prevMayachainStatus = useRef<OnlineStatus>(OnlineStatus.OFF)
  const mayachainStatus: OnlineStatus = useMemo(
    () =>
      FP.pipe(
        mimirStatusRD,
        RD.fold(
          () => prevMayachainStatus.current,
          () => prevMayachainStatus.current,
          () => {
            prevMayachainStatus.current = OnlineStatus.OFF
            return prevMayachainStatus.current
          },
          () => {
            prevMayachainStatus.current = OnlineStatus.ON
            return prevMayachainStatus.current
          }
        )
      ),
    [mimirStatusRD]
  )

  const { onlineStatus$ } = useAppContext()
  const onlineStatus = useObservableState<OnlineStatus>(onlineStatus$, OnlineStatus.OFF)
  const appOnlineStatusColor = useMemo(() => {
    if (onlineStatus === OnlineStatus.OFF) return 'red'
    if (
      midgardStatus === OnlineStatus.OFF ||
      thorchainStatus === OnlineStatus.OFF ||
      mayachainStatus === OnlineStatus.OFF ||
      midgardMayaStatus === OnlineStatus.OFF
    )
      return 'yellow'
    return 'green'
  }, [onlineStatus, midgardStatus, thorchainStatus, mayachainStatus, midgardMayaStatus])

  const menuItems = useMemo((): MenuItem[] => {
    const notConnectedTxt = intl.formatMessage({ id: 'settings.notconnected.title' })
    const midgardUrl = FP.pipe(
      midgardUrlRD,
      RD.getOrElse(() => '')
    )

    const midgardMayaUrl = FP.pipe(
      midgardUrlMayaRD,
      RD.getOrElse(() => '')
    )

    return [
      {
        key: 'midgard',
        headline: intl.formatMessage({ id: 'netstatus.midgard.title' }),
        url: `${midgardUrl}/v2/doc`,
        subheadline: headerNetStatusSubheadline({
          url: O.some(midgardUrl),
          onlineStatus: onlineStatus,
          clientStatus: midgardStatus,
          notConnectedTxt
        }),
        color: headerNetStatusColor({ onlineStatus: onlineStatus, clientStatus: midgardStatus })
      },
      {
        key: 'thorchain',
        headline: 'Thorchain API',
        url: `${thorchainNodeUrl}/thorchain/doc/`,
        subheadline: headerNetStatusSubheadline({
          url: O.some(thorchainNodeUrl),
          onlineStatus: onlineStatus,
          clientStatus: thorchainStatus,
          notConnectedTxt
        }),
        color: headerNetStatusColor({ onlineStatus: onlineStatus, clientStatus: thorchainStatus })
      },
      {
        key: 'thorchain-rpc',
        headline: 'Thorchain RPC',
        url: `${thorchainRpcUrl}`,
        subheadline: headerNetStatusSubheadline({
          url: O.some(thorchainRpcUrl),
          onlineStatus: onlineStatus,
          clientStatus: thorchainStatus,
          notConnectedTxt
        }),
        color: headerNetStatusColor({ onlineStatus: onlineStatus, clientStatus: thorchainStatus })
      },
      {
        key: 'midgardMaya',
        headline: intl.formatMessage({ id: 'netstatus.midgardMaya.title' }),
        url: `${midgardMayaUrl}/v2/doc`,
        subheadline: headerNetStatusSubheadline({
          url: O.some(midgardMayaUrl),
          onlineStatus: onlineStatus,
          clientStatus: midgardMayaStatus,
          notConnectedTxt
        }),
        color: headerNetStatusColor({ onlineStatus: onlineStatus, clientStatus: midgardMayaStatus })
      },
      {
        key: 'mayachain',
        headline: 'Mayachain API',
        url: `${mayachainNodeUrl}/mayachain/doc/`,
        subheadline: headerNetStatusSubheadline({
          url: O.some(mayachainNodeUrl),
          onlineStatus: onlineStatus,
          clientStatus: mayachainStatus,
          notConnectedTxt
        }),
        color: headerNetStatusColor({ onlineStatus: onlineStatus, clientStatus: mayachainStatus })
      },
      {
        key: 'mayachain-rpc',
        headline: 'Mayachain RPC',
        url: `${mayachainRpcUrl}`,
        subheadline: headerNetStatusSubheadline({
          url: O.some(mayachainRpcUrl),
          onlineStatus: onlineStatus,
          clientStatus: mayachainStatus,
          notConnectedTxt
        }),
        color: headerNetStatusColor({ onlineStatus: onlineStatus, clientStatus: mayachainStatus })
      }
    ]
  }, [
    intl,
    midgardUrlRD,
    midgardUrlMayaRD,
    onlineStatus,
    midgardStatus,
    midgardMayaStatus,
    thorchainNodeUrl,
    thorchainStatus,
    thorchainRpcUrl,
    mayachainNodeUrl,
    mayachainStatus,
    mayachainRpcUrl
  ])

  const desktopMenu = useMemo(() => {
    return FP.pipe(
      menuItems,
      A.map((item) => {
        const { headline, key, subheadline, color, url } = item
        return (
          <div
            key={key}
            className="flex items-center space-x-4 px-2 py-1"
            onClick={() => window.apiUrl.openExternal(url)}>
            <ConnectionStatus color={color} />
            <div className="flex flex-col">
              <Label
                className="pr-5 tracking-tight"
                color="normal"
                size="big"
                weight="bold"
                textTransform="uppercase"
                nowrap>
                {headline}
              </Label>
              <Label className="pr-5" size="small" textTransform="lowercase" nowrap>
                {subheadline}
              </Label>
            </div>
          </div>
        )
      })
    )
  }, [menuItems])

  const menuMobile = useMemo(() => {
    return menuItems.map((item) => {
      const { headline, key, subheadline, color } = item

      return (
        <div
          key={key}
          className="flex items-center space-x-4 px-6 h-[60px] border-b border-solid border-bg2 dark:border-bg2d last:border-none">
          <ConnectionStatus color={color} />
          <div className="flex flex-col">
            <Label className="pr-5" color="normal" size="big" weight="bold" textTransform="uppercase" nowrap>
              {headline}
            </Label>
            <Label className="pr-5" size="small" textTransform="lowercase" nowrap>
              {subheadline}
            </Label>
          </div>
        </div>
      )
    })
  }, [menuItems])

  return (
    <div className="flex flex-wrap">
      {isDesktopView && (
        <Dropdown
          anchor={{ to: 'bottom', gap: 4, padding: 8 }}
          trigger={
            <a onClick={(e) => e.preventDefault()}>
              <div className="flex items-center">
                <ConnectionStatus color={appOnlineStatusColor} />
                <DownIcon />
              </div>
            </a>
          }
          options={desktopMenu}
        />
      )}
      {!isDesktopView && <div className="w-full">{menuMobile}</div>}
    </div>
  )
}
