import React, { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import { AppExpertMode } from '../../components/settings/AppExpertMode'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useMayachainClientUrl } from '../../hooks/useMayachainClientUrl'
import { useNetwork } from '../../hooks/useNetwork'
import { usePrivateData } from '../../hooks/usePrivateData'
import { useThorchainClientUrl } from '../../hooks/useThorchainClientUrl'

export const AppExpertModeView: React.FC = (): JSX.Element => {
  const { network } = useNetwork()
  const {
    service: { apiEndpoint$, setMidgardUrl, checkMidgardUrl$ }
  } = useMidgardContext()
  const {
    service: {
      apiEndpoint$: apiEndpointMaya$,
      setMidgardUrl: setMidgardMayaUrl,
      checkMidgardUrl$: checkMidgardMayaUrl$
    }
  } = useMidgardMayaContext()
  const midgardUrl = useObservableState(apiEndpoint$, RD.initial)
  const midgardMayaUrl = useObservableState(apiEndpointMaya$, RD.initial)

  const { isPrivate, changePrivateData } = usePrivateData()

  const {
    node: thornodeNodeUrl,
    rpc: thornodeRpcUrl,
    setRpc: setThornodeRpcUrl,
    setNode: setThornodeNodeUrl,
    checkRpc$: checkThornodeRpcUrl$,
    checkNode$: checkThornodeNodeUrl$
  } = useThorchainClientUrl()

  const {
    node: mayanodeNodeUrl,
    rpc: mayanodeRpcUrl,
    setRpc: setMayanodeRpcUrl,
    setNode: setMayanodeNodeUrl,
    checkRpc$: checkMayanodeRpcUrl$,
    checkNode$: checkMayanodeNodeUrl$
  } = useMayachainClientUrl()

  const updateMidgardUrlHandler = useCallback(
    (url: string) => {
      setMidgardUrl(url, network)
    },
    [network, setMidgardUrl]
  )
  const updateMidgardMayaUrlHandler = useCallback(
    (url: string) => {
      setMidgardMayaUrl(url, network)
    },
    [network, setMidgardMayaUrl]
  )

  return (
    <AppExpertMode
      togglePrivate={changePrivateData}
      isPrivate={isPrivate}
      midgardUrl={midgardUrl}
      midgardMayaUrl={midgardMayaUrl}
      onChangeMidgardUrl={updateMidgardUrlHandler}
      onChangeMidgardMayaUrl={updateMidgardMayaUrlHandler}
      onChangeThornodeNodeUrl={setThornodeNodeUrl}
      onChangeThornodeRpcUrl={setThornodeRpcUrl}
      onChangeMayanodeNodeUrl={setMayanodeNodeUrl}
      onChangeMayanodeRpcUrl={setMayanodeRpcUrl}
      checkMidgardUrl$={checkMidgardUrl$}
      checkMidgardMayaUrl$={checkMidgardMayaUrl$}
      thornodeRpcUrl={thornodeRpcUrl}
      thornodeNodeUrl={thornodeNodeUrl}
      checkThornodeRpcUrl$={checkThornodeRpcUrl$}
      checkThornodeNodeUrl$={checkThornodeNodeUrl$}
      mayanodeRpcUrl={mayanodeRpcUrl}
      mayanodeNodeUrl={mayanodeNodeUrl}
      checkMayanodeRpcUrl$={checkMayanodeRpcUrl$}
      checkMayanodeNodeUrl$={checkMayanodeNodeUrl$}
    />
  )
}
