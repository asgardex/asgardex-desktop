import { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import { AppExpertMode } from '../../components/settings/AppExpertMode'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useEvmRpcUrl } from '../../hooks/useEvmRpcUrl'
import { useMayachainClientUrl } from '../../hooks/useMayachainClientUrl'
import { useNetwork } from '../../hooks/useNetwork'
import { useThorchainClientUrl } from '../../hooks/useThorchainClientUrl'

export const AppExpertModeView = (): JSX.Element => {
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

  // EVM RPC hooks
  const {
    url: ethRpcUrl,
    setUrl: setEthRpcUrl,
    checkUrl$: checkEthRpcUrl$,
    healthStatus: ethHealthStatus
  } = useEvmRpcUrl('ETH')
  const {
    url: bscRpcUrl,
    setUrl: setBscRpcUrl,
    checkUrl$: checkBscRpcUrl$,
    healthStatus: bscHealthStatus
  } = useEvmRpcUrl('BSC')
  const {
    url: arbRpcUrl,
    setUrl: setArbRpcUrl,
    checkUrl$: checkArbRpcUrl$,
    healthStatus: arbHealthStatus
  } = useEvmRpcUrl('ARB')
  const {
    url: avaxRpcUrl,
    setUrl: setAvaxRpcUrl,
    checkUrl$: checkAvaxRpcUrl$,
    healthStatus: avaxHealthStatus
  } = useEvmRpcUrl('AVAX')
  const {
    url: baseRpcUrl,
    setUrl: setBaseRpcUrl,
    checkUrl$: checkBaseRpcUrl$,
    healthStatus: baseHealthStatus
  } = useEvmRpcUrl('BASE')

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
      // EVM RPC configs
      ethRpc={{ url: ethRpcUrl, onChange: setEthRpcUrl, checkUrl$: checkEthRpcUrl$, healthStatus: ethHealthStatus }}
      bscRpc={{ url: bscRpcUrl, onChange: setBscRpcUrl, checkUrl$: checkBscRpcUrl$, healthStatus: bscHealthStatus }}
      arbRpc={{ url: arbRpcUrl, onChange: setArbRpcUrl, checkUrl$: checkArbRpcUrl$, healthStatus: arbHealthStatus }}
      avaxRpc={{
        url: avaxRpcUrl,
        onChange: setAvaxRpcUrl,
        checkUrl$: checkAvaxRpcUrl$,
        healthStatus: avaxHealthStatus
      }}
      baseRpc={{
        url: baseRpcUrl,
        onChange: setBaseRpcUrl,
        checkUrl$: checkBaseRpcUrl$,
        healthStatus: baseHealthStatus
      }}
    />
  )
}
