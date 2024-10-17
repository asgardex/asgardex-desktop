import * as RD from '@devexperts/remote-data-ts'
import * as FP from 'fp-ts/lib/function'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { useArbContext } from '../contexts/ArbContext'
import { useAvaxContext } from '../contexts/AvaxContext'
import { useBitcoinCashContext } from '../contexts/BitcoinCashContext'
import { useBitcoinContext } from '../contexts/BitcoinContext'
import { useBscContext } from '../contexts/BscContext'
import { useCosmosContext } from '../contexts/CosmosContext'
import { useDashContext } from '../contexts/DashContext'
import { useDogeContext } from '../contexts/DogeContext'
import { useEthereumContext } from '../contexts/EthereumContext'
import { useKujiContext } from '../contexts/KujiContext'
import { useLitecoinContext } from '../contexts/LitecoinContext'
import { useMayachainContext } from '../contexts/MayachainContext'
import { useThorchainContext } from '../contexts/ThorchainContext'
import { useXrdContext } from '../contexts/XrdContext'
import { liveData } from '../helpers/rx/liveData'

export type KeystoreClientStates = RD.RemoteData<Error, boolean>

export const useKeystoreClientStates = (): { clientStates: KeystoreClientStates } => {
  const { clientState$: btcClientState$ } = useBitcoinContext()
  const { clientState$: bchClientState$ } = useBitcoinCashContext()
  const { clientState$: ltcClientState$ } = useLitecoinContext()
  const { clientState$: ethClientState$ } = useEthereumContext()
  const { clientState$: thorClientState$ } = useThorchainContext()
  const { clientState$: mayaClientState$ } = useMayachainContext()
  const { clientState$: dogeClientState$ } = useDogeContext()
  const { clientState$: cosmosClientState$ } = useCosmosContext()
  const { clientState$: bscClientState$ } = useBscContext()
  const { clientState$: avaxClientState$ } = useAvaxContext()
  const { clientState$: xrdClientState$ } = useXrdContext()
  const { clientState$: kujiClientState$ } = useKujiContext()
  const { clientState$: dashClientState$ } = useDashContext()
  const { clientState$: arbClientState$ } = useArbContext()

  // State of initializing all clients
  const [clientStates] = useObservableState<KeystoreClientStates>(
    () =>
      FP.pipe(
        liveData.sequenceS({
          btc: btcClientState$,
          bch: bchClientState$,
          eth: ethClientState$,
          ltc: ltcClientState$,
          thor: thorClientState$,
          maya: mayaClientState$,
          doge: dogeClientState$,
          cosmos: cosmosClientState$,
          bsc: bscClientState$,
          avax: avaxClientState$,
          arb: arbClientState$,
          dash: dashClientState$,
          kuji: kujiClientState$,
          xrd: xrdClientState$
        }),
        liveData.map((_) => true),
        RxOp.startWith(RD.pending)
      ),
    RD.initial
  )

  return { clientStates }
}
