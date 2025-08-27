import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { AssetType, baseAmount } from '@xchainjs/xchain-util'
import { TxParams } from '@xchainjs/xchain-utxo'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { TrustedAddresses } from '../../../../shared/api/types'
import { Spin } from '../../../components/uielements/spin'
import { SendFormCOSMOS } from '../../../components/wallet/txs/send'
import { useChainContext } from '../../../contexts/ChainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { liveData } from '../../../helpers/rx/liveData'
import { getWalletBalanceByAssetAndWalletType } from '../../../helpers/walletHelper'
import { useObserveMayaScanPrice } from '../../../hooks/useMayascanPrice'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import { FeeRD } from '../../../services/chain/types'
import { WalletBalances } from '../../../services/clients'
import { PoolDetails as PoolDetailsMaya } from '../../../services/midgard/mayaMigard/types'
import { PoolAddress } from '../../../services/midgard/midgardTypes'
import { ZERO_ADDRESS } from '../../../services/solana/fees'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAsset, WalletBalance } from '../../../services/wallet/types'

type Props = {
  asset: SelectedWalletAsset
  trustedAddresses: TrustedAddresses | undefined
  emptyBalance: WalletBalance
  poolDetails: PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
}

export const SendViewCOSMOS = (props: Props): JSX.Element => {
  const { asset, trustedAddresses, emptyBalance, poolDetails, oPoolAddress } = props

  const { chain } =
    asset.asset.type === AssetType.SYNTH
      ? AssetCacao
      : asset.asset.type === AssetType.SECURED
      ? AssetRuneNative
      : asset.asset

  const { network } = useNetwork()
  const {
    balancesState$,
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const { mayaScanPriceRD } = useObserveMayaScanPrice()

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(chain))

  const oWalletBalance = useMemo(() => {
    return getWalletBalanceByAssetAndWalletType({
      oWalletBalances: oBalances,
      asset: asset.asset,
      walletType: asset.walletType
    })
  }, [asset.asset, asset.walletType, oBalances])

  const { transfer$, standaloneLedgerFees$, reloadStandaloneLedgerFees } = useChainContext()

  // Use centralized fees that support standalone ledger mode
  const fees$ = (params: TxParams) =>
    standaloneLedgerFees$({
      chain,
      amount: params.amount,
      recipient: params.recipient
    })

  // Use centralized reload function that works with standaloneLedgerFees$
  const reloadFeesHandler = () => reloadStandaloneLedgerFees(chain)

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$({
          amount: baseAmount(1),
          recipient: ZERO_ADDRESS
        }),
        liveData.map((fees) => {
          return fees.fast
        })
      ),
    RD.initial
  )

  const { validateAddress } = useValidateAddress(chain)

  return FP.pipe(
    oWalletBalance,
    O.fold(
      () => (
        <Spin>
          <div className="flex flex-col items-center justify-center overflow-auto bg-bg0 dark:bg-bg0d">
            <SendFormCOSMOS
              asset={asset}
              trustedAddresses={trustedAddresses}
              balances={FP.pipe(
                oBalances,
                O.getOrElse<WalletBalances>(() => [])
              )}
              balance={emptyBalance}
              transfer$={transfer$}
              openExplorerTxUrl={openExplorerTxUrl}
              getExplorerTxUrl={getExplorerTxUrl}
              addressValidation={validateAddress}
              fee={feeRD}
              reloadFeesHandler={reloadFeesHandler}
              validatePassword$={validatePassword$}
              network={network}
              poolDetails={poolDetails}
              mayaScanPrice={mayaScanPriceRD}
              oPoolAddress={oPoolAddress}
            />
          </div>
        </Spin>
      ),
      (walletBalance) => (
        <div className="flex flex-col items-center justify-center overflow-auto bg-bg0 dark:bg-bg0d">
          <SendFormCOSMOS
            asset={asset}
            trustedAddresses={trustedAddresses}
            balances={FP.pipe(
              oBalances,
              O.getOrElse<WalletBalances>(() => [])
            )}
            balance={walletBalance}
            transfer$={transfer$}
            openExplorerTxUrl={openExplorerTxUrl}
            getExplorerTxUrl={getExplorerTxUrl}
            addressValidation={validateAddress}
            fee={feeRD}
            reloadFeesHandler={reloadFeesHandler}
            validatePassword$={validatePassword$}
            network={network}
            poolDetails={poolDetails}
            mayaScanPrice={mayaScanPriceRD}
            oPoolAddress={oPoolAddress}
          />
        </div>
      )
    )
  )
}
