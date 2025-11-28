import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AssetType, baseAmount, Asset, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { scheduled, asapScheduler } from 'rxjs'

import { TrustedAddresses } from '../../../../shared/api/types'
import { isChainOfMaya, isSupportedChain } from '../../../../shared/utils/chain'
import { BackLinkButton, RefreshButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { SendForm } from '../../../components/wallet/txs/send'
import { useChainContext } from '../../../contexts/ChainContext'
import { useEvmContext } from '../../../contexts/EvmContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { isUtxoAssetChain } from '../../../helpers/assetHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { isEvmChain } from '../../../helpers/evmHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { getWalletBalanceByAddress, getWalletBalanceByAssetAndWalletType } from '../../../helpers/walletHelper'
import { useObserveMayaScanPrice } from '../../../hooks/useMayascanPrice'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import { FeeRD } from '../../../services/chain/types'
import { FeesRD, WalletBalances } from '../../../services/clients'
import { EVMZeroAddress } from '../../../services/evm/const'
import { PoolDetails as PoolDetailsMaya } from '../../../services/midgard/mayaMidgard/types'
import { PoolAddress, PoolDetails } from '../../../services/midgard/midgardTypes'
import { ZERO_ADDRESS } from '../../../services/solana/fees'
import { userAddresses$ } from '../../../services/storage/userAddresses'
import { FeesWithRatesLD } from '../../../services/utxo/types'
import { reloadBalancesByChain } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAsset, WalletBalance } from '../../../services/wallet/types'

type UnifiedSendViewProps = {
  asset: SelectedWalletAsset
  trustedAddresses: TrustedAddresses | undefined
  emptyBalance: WalletBalance
  poolDetails: PoolDetails | PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
  oPoolAddressMaya: O.Option<PoolAddress>
}

const UnifiedSendView = (props: UnifiedSendViewProps): JSX.Element => {
  const { asset, trustedAddresses, emptyBalance, poolDetails, oPoolAddress, oPoolAddressMaya } = props

  const { network } = useNetwork()
  const { mayaScanPriceRD } = useObserveMayaScanPrice()

  const {
    balancesState$,
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const chain = (
    asset.asset.type === AssetType.SYNTH
      ? MAYAChain
      : asset.asset.type === AssetType.SECURED
        ? THORChain
        : asset.asset.chain
  ) as Chain

  const { validateAddress } = useValidateAddress(chain)
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(chain))

  const isUTXOChain = isUtxoAssetChain({ ...asset.asset, chain })
  const isEVMChain = isEvmChain(chain)
  const isCOSMOSChain = !isUTXOChain && !isEVMChain

  const oWalletBalance = useMemo(() => {
    if (isUTXOChain) {
      return FP.pipe(
        oBalances,
        O.chain((balances) => getWalletBalanceByAddress(balances, asset.walletAddress))
      )
    } else {
      return getWalletBalanceByAssetAndWalletType({
        oWalletBalances: oBalances,
        asset: asset.asset,
        walletType: asset.walletType
      })
    }
  }, [asset, oBalances, isUTXOChain])

  const {
    transfer$,
    poolDeposit$: deposit$,
    evmFees$,
    standaloneLedgerFees$,
    reloadStandaloneLedgerFees,
    utxoFeesWithRates$,
    reloadUtxoFeesWithRates$
  } = useChainContext()

  const { reloadFees } = useEvmContext(chain)

  const evmFeesObservable = useMemo(
    () =>
      isEVMChain
        ? evmFees$({
            chain: chain,
            asset: getChainAsset(chain),
            amount: baseAmount(1),
            recipient: EVMZeroAddress,
            from: asset.walletAddress
          })
        : scheduled([RD.initial], asapScheduler),
    [isEVMChain, chain, asset.walletAddress, evmFees$]
  )
  const feesRD = useObservableState<FeesRD>(evmFeesObservable, RD.initial)

  const cosmosFeesObservable = useMemo(
    () =>
      isCOSMOSChain
        ? FP.pipe(
            standaloneLedgerFees$({
              chain,
              amount: baseAmount(1),
              recipient: ZERO_ADDRESS
            }),
            liveData.map((fees) => fees.fast)
          )
        : scheduled([RD.initial], asapScheduler),
    [isCOSMOSChain, chain, standaloneLedgerFees$]
  )
  const feeRD = useObservableState<FeeRD>(cosmosFeesObservable, RD.initial)

  const utxoFeesObservable: FeesWithRatesLD = useMemo(
    () =>
      isUTXOChain
        ? utxoFeesWithRates$(asset.asset as Asset, asset.walletAddress)
        : scheduled([RD.initial], asapScheduler),
    [asset, utxoFeesWithRates$, isUTXOChain]
  )

  const feesWithRatesRD = useObservableState(utxoFeesObservable, RD.initial)

  const reloadFeesHandler = () => {
    if (isEVMChain) {
      reloadFees({
        asset: getChainAsset(chain),
        amount: baseAmount(1),
        recipient: EVMZeroAddress,
        from: asset.walletAddress
      })
    } else if (isCOSMOSChain) {
      reloadStandaloneLedgerFees(chain)
    } else if (isUTXOChain) {
      reloadUtxoFeesWithRates$(asset.asset as Asset)
    }
  }

  return FP.pipe(
    oWalletBalance,
    O.fold(
      () => (
        <Spin>
          <div className="flex flex-col items-center justify-center overflow-auto bg-bg0 dark:bg-bg0d">
            <SendForm
              asset={asset}
              trustedAddresses={trustedAddresses}
              balances={FP.pipe(
                oBalances,
                O.getOrElse<WalletBalances>(() => [])
              )}
              balance={emptyBalance}
              transfer$={transfer$}
              deposit$={isEVMChain ? deposit$ : undefined}
              openExplorerTxUrl={openExplorerTxUrl}
              getExplorerTxUrl={getExplorerTxUrl}
              addressValidation={validateAddress}
              fees={isEVMChain ? feesRD : undefined}
              fee={isCOSMOSChain ? feeRD : undefined}
              feesWithRates={isUTXOChain ? feesWithRatesRD : undefined}
              reloadFeesHandler={reloadFeesHandler}
              validatePassword$={validatePassword$}
              network={network}
              poolDetails={poolDetails}
              mayaScanPrice={mayaScanPriceRD}
              oPoolAddress={oPoolAddress}
              oPoolAddressMaya={oPoolAddressMaya}
            />
          </div>
        </Spin>
      ),
      (walletBalance) => (
        <div className="flex flex-col items-center justify-center overflow-auto bg-bg0 dark:bg-bg0d">
          <SendForm
            asset={asset}
            trustedAddresses={trustedAddresses}
            balances={FP.pipe(
              oBalances,
              O.getOrElse<WalletBalances>(() => [])
            )}
            balance={walletBalance}
            transfer$={transfer$}
            deposit$={isEVMChain ? deposit$ : undefined}
            openExplorerTxUrl={openExplorerTxUrl}
            getExplorerTxUrl={getExplorerTxUrl}
            addressValidation={validateAddress}
            fees={isEVMChain ? feesRD : undefined}
            fee={isCOSMOSChain ? feeRD : undefined}
            feesWithRates={isUTXOChain ? feesWithRatesRD : undefined}
            reloadFeesHandler={reloadFeesHandler}
            validatePassword$={validatePassword$}
            network={network}
            poolDetails={poolDetails}
            mayaScanPrice={mayaScanPriceRD}
            oPoolAddress={oPoolAddress}
            oPoolAddressMaya={oPoolAddressMaya}
          />
        </div>
      )
    )
  )
}

export const SendView = (): JSX.Element => {
  const intl = useIntl()

  const { selectedAsset$ } = useWalletContext()

  const [trustedAddresses, setTrustedAddresses] = useState<TrustedAddresses>()

  useEffect(() => {
    const subscription = userAddresses$.subscribe((addresses) => setTrustedAddresses({ addresses }))
    return () => subscription.unsubscribe()
  }, [])

  const oSelectedAsset = useObservableState(selectedAsset$, O.none)

  const {
    service: {
      pools: { selectedPoolAddress$, poolsState$: poolsStateThor$ },
      setSelectedPoolAsset
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { selectedPoolAddress$: selectedPoolAddressMaya$, poolsState$: poolsStateMaya$ },
      setSelectedPoolAsset: setSelectedPoolAssetMaya
    }
  } = useMidgardMayaContext()

  useEffect(() => {
    FP.pipe(
      oSelectedAsset,
      O.fold(
        () => setSelectedPoolAsset(O.none),
        (asset) => {
          setSelectedPoolAsset(O.some(asset.asset))
          setSelectedPoolAssetMaya(O.some(asset.asset))
        }
      )
    )
    return () => {
      setSelectedPoolAsset(O.none)
      setSelectedPoolAssetMaya(O.none)
    }
  }, [setSelectedPoolAsset, setSelectedPoolAssetMaya, oSelectedAsset])

  const poolsStateThorRD = useObservableState(poolsStateThor$, RD.pending)
  const poolsStateMayaRD = useObservableState(poolsStateMaya$, RD.pending)

  const oPoolAddress: O.Option<PoolAddress> = useObservableState(selectedPoolAddress$, O.none)

  const oPoolAddressMaya: O.Option<PoolAddress> = useObservableState(selectedPoolAddressMaya$, O.none)

  const renderSendView = useCallback(
    (asset: SelectedWalletAsset) => {
      const chain =
        asset.asset.type === AssetType.SYNTH
          ? MAYAChain
          : asset.asset.type === AssetType.SECURED
            ? THORChain
            : asset.asset.chain
      if (!isSupportedChain(chain)) {
        return (
          <h1>
            {intl.formatMessage(
              { id: 'wallet.errors.invalidChain' },
              {
                chain
              }
            )}
          </h1>
        )
      }
      const poolDetailsThor = RD.toNullable(poolsStateThorRD)?.poolDetails ?? []
      const poolDetailsMaya = RD.toNullable(poolsStateMayaRD)?.poolDetails ?? []
      const DEFAULT_WALLET_BALANCE = {
        walletAddress: asset.walletAddress,
        walletType: asset.walletType,
        walletAccount: asset.walletAccount,
        walletIndex: asset.walletIndex,
        hdMode: asset.hdMode,
        amount: baseAmount(0),
        asset: asset.asset
      }

      return (
        <UnifiedSendView
          asset={asset}
          trustedAddresses={trustedAddresses}
          emptyBalance={DEFAULT_WALLET_BALANCE}
          poolDetails={!isChainOfMaya(asset.asset.chain) ? poolDetailsThor : poolDetailsMaya}
          oPoolAddress={oPoolAddress}
          oPoolAddressMaya={oPoolAddressMaya}
        />
      )
    },
    [poolsStateThorRD, poolsStateMayaRD, intl, trustedAddresses, oPoolAddress, oPoolAddressMaya]
  )

  return FP.pipe(
    oSelectedAsset,
    O.fold(
      () => <></>,
      (selectedAsset) => (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <BackLinkButton />
            <RefreshButton
              onClick={reloadBalancesByChain(
                selectedAsset.asset.type === AssetType.SYNTH
                  ? MAYAChain
                  : selectedAsset.asset.type === AssetType.SECURED
                    ? THORChain
                    : selectedAsset.asset.chain,
                selectedAsset.walletType
              )}
            />
          </div>
          <div className="flex flex-col justify-center">{renderSendView(selectedAsset)}</div>
        </div>
      )
    )
  )
}
