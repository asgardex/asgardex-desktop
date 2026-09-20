import { useCallback } from 'react'

import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { ProtocolsLp } from '../../components/uielements/protocolSwitch/types'
import * as bondsRoutes from '../../routes/bonds'
import { useApp } from '../../store/app/hooks'

export const BondsLayout = (): JSX.Element => {
  const { protocol, setProtocol } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()

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
