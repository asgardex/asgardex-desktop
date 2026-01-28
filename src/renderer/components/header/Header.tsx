import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useMayachainClientUrl } from '../../hooks/useMayachainClientUrl'
import { useMayaPrice } from '../../hooks/useMayaPrice'
import { useNetwork } from '../../hooks/useNetwork'
import { usePricePools } from '../../hooks/usePricePools'
import { useRunePrice } from '../../hooks/useRunePrice'
import { useTcyPrice } from '../../hooks/useTcyPrice'
import { useThorchainClientUrl } from '../../hooks/useThorchainClientUrl'
import { useVolume24PriceMaya } from '../../hooks/useVolume24HrPriceMaya'
import { useVolume24Price } from '../../hooks/useVolume24Price'
import { SelectedPricePoolAsset } from '../../services/midgard/midgardTypes'
import { HeaderComponent } from './HeaderComponent'

export const Header = (): JSX.Element => {
  const { state: keystoreState } = useKeystoreState()
  const { appWalletService } = useWalletContext()

  // Use unified lock from appWalletService (routes to correct wallet type)
  const lock = appWalletService.lock

  // Subscribe to unified isLocked$ observable
  const isLocked = useObservableState(appWalletService.isLocked$, true)

  // Phase D: Subscribe to unified wallet observables
  const allWallets = useObservableState(appWalletService.allWallets$, [])
  const activeWallet = useObservableState(appWalletService.activeWallet$, O.none)

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

  const oSelectedPricePoolAsset = useObservableState<SelectedPricePoolAsset>(selectedPricePoolAsset$, O.none)

  const { runePriceRD, reloadRunePrice } = useRunePrice()
  const { tcyPriceRD, reloadTcyPrice } = useTcyPrice()
  const { mayaPriceRD, reloadMayaPrice } = useMayaPrice()
  const { volume24PriceRD, reloadVolume24Price } = useVolume24Price()
  const { volume24PriceRD: volume24PriceMayaRD, reloadVolume24Price: reloadVolume24PriceMaya } = useVolume24PriceMaya()

  const pricePools = usePricePools()

  const midgardStatusRD = useObservableState(healthStatus$, RD.initial)
  const midgardMayaStatusRD = useObservableState(healthStatusMaya$, RD.initial)

  const midgardUrlRD = useObservableState(apiEndpoint$, RD.initial)
  const midgardMayaUrlRD = useObservableState(apiEndpointMaya$, RD.initial)

  const { node: thorchainNodeUrl, rpc: thorchainRpcUrl } = useThorchainClientUrl()
  const { node: mayachainNodeUrl, rpc: mayachainRpcUrl } = useMayachainClientUrl()

  return (
    <HeaderComponent
      network={network}
      keystore={keystoreState}
      lockHandler={lock}
      isLocked={isLocked}
      // Phase D: Unified wallet props
      allWallets={allWallets}
      activeWallet={activeWallet}
      selectWallet={appWalletService.selectWallet}
      vaultManager={appWalletService.vaultManager}
      pricePools={pricePools}
      setSelectedPricePool={setSelectedPricePool}
      runePrice={runePriceRD}
      reloadRunePrice={reloadRunePrice}
      tcyPrice={tcyPriceRD}
      reloadTcyPrice={reloadTcyPrice}
      mayaPrice={mayaPriceRD}
      reloadMayaPrice={reloadMayaPrice}
      volume24PriceRune={volume24PriceRD}
      volume24PriceMaya={volume24PriceMayaRD}
      reloadVolume24PriceRune={reloadVolume24Price}
      reloadVolume24PriceMaya={reloadVolume24PriceMaya}
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
