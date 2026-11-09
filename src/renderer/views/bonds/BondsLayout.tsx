import { useCallback } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { WarningView } from '../../components/shared/warning'
import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { Protocol, ProtocolsLp } from '../../components/uielements/protocolSwitch/types'
import { useWalletContext } from '../../contexts/WalletContext'
import { useNetwork } from '../../hooks/useNetwork'
import * as bondsRoutes from '../../routes/bonds'
import { isVultisigMode } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'
import { LegacyBondsView } from './LegacyBondsView'

export const BondsLayout = (): JSX.Element => {
  const intl = useIntl()
  const { protocol, setProtocol } = useApp()
  const { network } = useNetwork()
  const { appWalletService } = useWalletContext()
  const appWalletState = useObservableState(appWalletService.appWalletState$)
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
      {protocol === Protocol.MAYAChain ? (
        <LegacyBondsView />
      ) : appWalletState && isVultisigMode(appWalletState) ? (
        <WarningView subTitle={intl.formatMessage({ id: 'wallet.vultisig.notImplemented' })} />
      ) : protocol === Protocol.THORChain && network !== Network.Mainnet ? (
        <WarningView subTitle={intl.formatMessage({ id: 'bonds.mainnetOnly' })} />
      ) : (
        <Outlet />
      )}
    </>
  )
}
