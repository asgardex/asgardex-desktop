import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletAddress } from '../../../shared/wallet/types'
import { WalletAddress$ } from '../../services/clients'
import { WalletAccount } from '../../services/wallet/types'

export const walletAccount$ = ({
  addressUI$,
  ledgerAddress: oLedgerAddress,
  chain
}: {
  addressUI$: WalletAddress$
  ledgerAddress: O.Option<WalletAddress>
  chain: Chain
}): Rx.Observable<O.Option<WalletAccount>> =>
  FP.pipe(
    addressUI$, // all `keystore` based
    RxOp.map((oKeystoreAddress) =>
      FP.pipe(
        oKeystoreAddress,
        O.map((keystoreAddress) => ({ chain, accounts: { keystore: keystoreAddress, ledger: oLedgerAddress } }))
      )
    )
  )
