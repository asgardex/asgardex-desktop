import { useCallback } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { useIntl } from 'react-intl'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { WarningView } from '../../components/shared/warning'
import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { Protocol, ProtocolsLp } from '../../components/uielements/protocolSwitch/types'
import { useNetwork } from '../../hooks/useNetwork'
import * as bondsRoutes from '../../routes/bonds'
import { useApp } from '../../store/app/hooks'

export const BondsLayout = (): JSX.Element => {
  const intl = useIntl()
  const { protocol, setProtocol } = useApp()
  const { network } = useNetwork()
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
      {protocol === Protocol.THORChain && network !== Network.Mainnet ? (
        <WarningView subTitle={intl.formatMessage({ id: 'bonds.mainnetOnly' })} />
      ) : (
        <Outlet />
      )}
    </>
  )
}
