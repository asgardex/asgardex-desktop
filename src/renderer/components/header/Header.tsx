import React from 'react'

import * as RD from '@devexperts/remote-data-ts'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'

import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useDex } from '../../hooks/useDex'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import { useMayachainClientUrl } from '../../hooks/useMayachainClientUrl'
import { useMayaPrice } from '../../hooks/useMayaPrice'
import { useNetwork } from '../../hooks/useNetwork'
import { usePricePools } from '../../hooks/usePricePools'
import { useRunePrice } from '../../hooks/useRunePrice'
import { useThorchainClientUrl } from '../../hooks/useThorchainClientUrl'
import { useVolume24PriceMaya } from '../../hooks/useVolume24HrPriceMaya'
import { useVolume24Price } from '../../hooks/useVolume24Price'
import { SelectedPricePoolAsset } from '../../services/midgard/types'
import { HeaderComponent } from './HeaderComponent'

export const Header: React.FC = (): JSX.Element => {
  const { lock, state: keystoreState, change$: changeWalletHandler$ } = useKeystoreState()
  const { walletsUI } = useKeystoreWallets()
  const { mimir$ } = useThorchainContext()
  const mimir = useObservableState(mimir$, RD.initial)
  const { service: midgardService } = useMidgardContext()
  const { service: midgardServiceMaya } = useMidgardMayaContext()
  const {
    pools: { setSelectedPricePoolAsset: setSelectedPricePool, selectedPricePoolAsset$ },
    apiEndpoint$,
    healthStatus$
  } = midgardService
  const { apiEndpoint$: apiEndpointMaya$, healthStatus$: healthStatusMaya$ } = midgardServiceMaya

  const { network } = useNetwork()
  const { dex, changeDex } = useDex()

  const oSelectedPricePoolAsset = useObservableState<SelectedPricePoolAsset>(selectedPricePoolAsset$, O.none)

  const { runePriceRD, reloadRunePrice } = useRunePrice()
  const { mayaPriceRD, reloadMayaPrice } = useMayaPrice()
  const { volume24PriceRD, reloadVolume24Price } = useVolume24Price()
  const { volume24PriceRD: volume24PriceMayaRD, reloadVolume24Price: reloadVolume24PriceMaya } = useVolume24PriceMaya()
  const volume24HrRD = dex.chain === 'THOR' ? volume24PriceRD : volume24PriceMayaRD
  const reloadVolume24HrRD = dex.chain === 'THOR' ? reloadVolume24Price : reloadVolume24PriceMaya
  const pricePools = usePricePools()

  const midgardStatusRD = useObservableState(healthStatus$, RD.initial)
  const midgardMayaStatusRD = useObservableState(healthStatusMaya$, RD.initial)

  const midgardUrlRD = useObservableState(apiEndpoint$, RD.initial)
  const midgardMayaUrlRD = useObservableState(apiEndpointMaya$, RD.initial)
  const { node: thorchainNodeUrl, rpc: thorchainRpcUrl } = useThorchainClientUrl()
  const { node: mayachainNodeUrl, rpc: mayachainRpcUrl } = useMayachainClientUrl()

  return (
    <HeaderComponent
      dex={dex}
      changeDex={changeDex}
      network={network}
      keystore={keystoreState}
      wallets={walletsUI}
      lockHandler={lock}
      changeWalletHandler$={changeWalletHandler$}
      pricePools={pricePools}
      setSelectedPricePool={setSelectedPricePool}
      runePrice={runePriceRD}
      reloadRunePrice={reloadRunePrice}
      mayaPrice={mayaPriceRD}
      reloadMayaPrice={reloadMayaPrice}
      volume24Price={volume24HrRD}
      reloadVolume24Price={reloadVolume24HrRD}
      selectedPricePoolAsset={oSelectedPricePoolAsset}
      midgardStatus={midgardStatusRD}
      midgardMayaStatus={midgardMayaStatusRD}
      mimir={mimir}
      midgardUrl={midgardUrlRD}
      midgardMayaUrl={midgardMayaUrlRD}
      thorchainNodeUrl={thorchainNodeUrl}
      thorchainRpcUrl={thorchainRpcUrl}
      mayachainNodeUrl={mayachainNodeUrl}
      mayachainRpcUrl={mayachainRpcUrl}
    />
  )
}
