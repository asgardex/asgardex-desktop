import { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { PROVIDER_REGISTRY } from '../../../shared/providers'
import { ProviderId, ProviderSectionKey } from '../../../shared/providers/types'
import { AppExpertMode } from '../../components/settings/AppExpertMode'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useEvmGasMultiplier } from '../../hooks/useEvmGasMultiplier'
import { useEvmRpcUrl } from '../../hooks/useEvmRpcUrl'
import { useMayachainClientUrl } from '../../hooks/useMayachainClientUrl'
import { useNetwork } from '../../hooks/useNetwork'
import { useThorchainClientUrl } from '../../hooks/useThorchainClientUrl'
import { applyProvider } from '../../services/storage/common'

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

  // EVM Gas multiplier
  const { multiplier: gasMultiplier, setMultiplier: setGasMultiplier } = useEvmGasMultiplier()

  // Derive active provider by matching current URLs against the registry for the active network.
  // Compare per-network (not hardcoded to mainnet) so detection works on stagenet/testnet too.
  const detectProvider = useCallback(
    (section: ProviderSectionKey, currentUrls: Record<string, string>): ProviderId => {
      const config = PROVIDER_REGISTRY[section]
      for (const provider of config.providers) {
        const urls = provider.urls as Record<string, Record<string, string>>
        const allMatch = config.slots.every((slot) => urls[slot as string]?.[network] === currentUrls[slot as string])
        if (allMatch) return provider.id
      }
      return 'custom'
    },
    [network]
  )

  const thorchainProvider = detectProvider('thorchain', {
    midgard: FP.pipe(midgardUrl, RD.toNullable) ?? '',
    thornodeApi: thornodeNodeUrl,
    thornodeRpc: thornodeRpcUrl
  })

  const mayachainProvider = detectProvider('mayachain', {
    midgardMaya: FP.pipe(midgardMayaUrl, RD.toNullable) ?? '',
    mayanodeApi: mayanodeNodeUrl,
    mayanodeRpc: mayanodeRpcUrl
  })

  const handleChangeProvider = useCallback((section: ProviderSectionKey, providerId: ProviderId) => {
    applyProvider(section, providerId)
  }, [])

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
      // EVM Gas multiplier
      gasMultiplier={gasMultiplier}
      onChangeGasMultiplier={setGasMultiplier}
      // Provider selections (derived from current URLs)
      thorchainProvider={thorchainProvider}
      mayachainProvider={mayachainProvider}
      onChangeProvider={handleChangeProvider}
    />
  )
}
