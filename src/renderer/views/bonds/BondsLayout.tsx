import { useCallback } from 'react'

import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { ProtocolsLp } from '../../components/uielements/protocolSwitch/types'
import * as bondsRoutes from '../../routes/bonds'
import { useApp } from '../../store/app/hooks'

/**
 * Shared chrome of every `/bonds` route.
 *
 * Keeping the protocol switch in a layout (instead of inside each view) means
 * it stays mounted and visible while navigating into the node detail or the
 * reward history, rather than disappearing on those routes.
 */
export const BondsLayout = (): JSX.Element => {
  const { protocol, setProtocol } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Node detail and reward history are THORChain-only views: switching the
  // protocol there would leave THOR data on screen under a MAYA selection, so
  // the switch takes the user back to the bonds overview.
  const changeProtocol = useCallback(
    (nextProtocol: string) => {
      setProtocol(nextProtocol)
      if (pathname !== bondsRoutes.base.template) {
        navigate(bondsRoutes.base.path())
      }
    },
    [navigate, pathname, setProtocol]
  )

  return (
    <>
      <div className="flex w-full justify-end pb-10px">
        <ProtocolSwitch protocol={protocol} setProtocol={changeProtocol} protocols={ProtocolsLp} />
      </div>
      <Outlet />
    </>
  )
}
