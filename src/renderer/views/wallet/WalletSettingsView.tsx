import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BNBChain } from '@xchainjs/xchain-binance'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { XChainClient } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { LedgerErrorId } from '../../../shared/api/types'
import { DEFAULT_EVM_HD_MODE, EvmHDMode } from '../../../shared/evm/types'
import { isEnabledChain } from '../../../shared/utils/chain'
import { HDMode } from '../../../shared/wallet/types'
import { WalletSettings } from '../../components/settings'
import { useAvaxContext } from '../../contexts/AvaxContext'
import { useBinanceContext } from '../../contexts/BinanceContext'
import { useBitcoinCashContext } from '../../contexts/BitcoinCashContext'
import { useBitcoinContext } from '../../contexts/BitcoinContext'
import { useBscContext } from '../../contexts/BscContext'
import { useChainContext } from '../../contexts/ChainContext'
import { useCosmosContext } from '../../contexts/CosmosContext'
import { useDashContext } from '../../contexts/DashContext'
import { useDogeContext } from '../../contexts/DogeContext'
import { useEthereumContext } from '../../contexts/EthereumContext'
import { useLitecoinContext } from '../../contexts/LitecoinContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import {
  filterEnabledChains,
  isBchChain,
  isDogeChain,
  isBnbChain,
  isBtcChain,
  isLtcChain,
  isThorChain,
  isEthChain,
  isCosmosChain,
  isAvaxChain,
  isBscChain,
  isMayaChain,
  isDashChain
} from '../../helpers/chainHelper'
import { sequenceTOptionFromArray } from '../../helpers/fpHelpers'
import { useCollapsedSetting } from '../../hooks/useCollapsedSetting'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import { useLedger } from '../../hooks/useLedger'
import { useNetwork } from '../../hooks/useNetwork'
import { LedgerAddressLD, KeystoreUnlocked, VerifiedLedgerAddressLD } from '../../services/wallet/types'
import { walletAccount$ } from './WalletSettingsView.helper'

type Props = {
  keystoreUnlocked: KeystoreUnlocked
}

export const WalletSettingsView: React.FC<Props> = ({ keystoreUnlocked }): JSX.Element => {
  const { id: keystoreId } = keystoreUnlocked

  const { walletsUI } = useKeystoreWallets()

  const {
    keystoreService: { exportKeystore, validatePassword$ }
  } = useWalletContext()

  const { lock, remove, change$, rename$ } = useKeystoreState()

  const { network } = useNetwork()

  const { collapsed, toggle: toggleCollapse } = useCollapsedSetting('wallet')

  const { address$: thorAddressUI$ } = useThorchainContext()
  const { addressUI$: bnbAddressUI$ } = useBinanceContext()
  const { addressUI$: ethAddressUI$, ethHDMode$, updateEvmHDMode } = useEthereumContext()
  const { addressUI$: avaxAddressUI$ } = useAvaxContext()
  const { addressUI$: bscAddressUI$ } = useBscContext()
  const { addressUI$: btcAddressUI$ } = useBitcoinContext()
  const { addressUI$: ltcAddressUI$ } = useLitecoinContext()
  const { addressUI$: bchAddressUI$ } = useBitcoinCashContext()
  const { addressUI$: dogeAddressUI$ } = useDogeContext()
  const { addressUI$: cosmosAddressUI$ } = useCosmosContext()
  const { addressUI$: mayaAddressUI$ } = useMayachainContext()
  const { addressUI$: dashAddressUI$ } = useDashContext()

  const evmHDMode: EvmHDMode = useObservableState(ethHDMode$, DEFAULT_EVM_HD_MODE)

  const {
    addAddress: addLedgerThorAddress,
    verifyAddress: verifyLedgerThorAddress,
    address: oThorLedgerWalletAddress,
    removeAddress: removeLedgerThorAddress
  } = useLedger(THORChain, keystoreId)

  const {
    addAddress: addLedgerBnbAddress,
    verifyAddress: verifyLedgerBnbAddress,
    address: oBnbLedgerWalletAddress,
    removeAddress: removeLedgerBnbAddress
  } = useLedger(BNBChain, keystoreId)

  const {
    addAddress: addLedgerBtcAddress,
    verifyAddress: verifyLedgerBtcAddress,
    address: oBtcLedgerWalletAddress,
    removeAddress: removeLedgerBtcAddress
  } = useLedger(BTCChain, keystoreId)

  const {
    addAddress: addLedgerDashAddress,
    verifyAddress: verifyLedgerDashAddress,
    address: oDashLedgerWalletAddress,
    removeAddress: removeLedgerDashAddress
  } = useLedger(DASHChain, keystoreId)

  const {
    addAddress: addLedgerLtcAddress,
    verifyAddress: verifyLedgerLtcAddress,
    address: oLtcLedgerWalletAddress,
    removeAddress: removeLedgerLtcAddress
  } = useLedger(LTCChain, keystoreId)

  const {
    addAddress: addLedgerBchAddress,
    verifyAddress: verifyLedgerBchAddress,
    address: oBchLedgerWalletAddress,
    removeAddress: removeLedgerBchAddress
  } = useLedger(BCHChain, keystoreId)

  const {
    addAddress: addLedgerDOGEAddress,
    verifyAddress: verifyLedgerDOGEAddress,
    address: oDogeLedgerWalletAddress,
    removeAddress: removeLedgerDOGEAddress
  } = useLedger(DOGEChain, keystoreId)

  const {
    addAddress: addLedgerEthAddress,
    verifyAddress: verifyLedgerEthAddress,
    address: oEthLedgerWalletAddress,
    removeAddress: removeLedgerEthAddress
  } = useLedger(ETHChain, keystoreId)
  const {
    addAddress: addLedgerAvaxAddress,
    verifyAddress: verifyLedgerAvaxAddress,
    address: oAvaxLedgerWalletAddress,
    removeAddress: removeLedgerAvaxAddress
  } = useLedger(AVAXChain, keystoreId)
  const {
    addAddress: addLedgerBscAddress,
    verifyAddress: verifyLedgerBscAddress,
    address: oBscLedgerWalletAddress,
    removeAddress: removeLedgerBscAddress
  } = useLedger(BSCChain, keystoreId)

  const {
    addAddress: addLedgerCosmosAddress,
    verifyAddress: verifyLedgerCosmosAddress,
    address: oCosmosLedgerWalletAddress,
    removeAddress: removeLedgerCosmosAddress
  } = useLedger(GAIAChain, keystoreId)

  const {
    addAddress: addLedgerMayaAddress,
    verifyAddress: verifyLedgerMayaAddress,
    address: oMayaLedgerWalletAddress,
    removeAddress: removeLedgerMayaAddress
  } = useLedger(MAYAChain, keystoreId)

  const addLedgerAddressHandler = ({
    chain,
    walletIndex,
    hdMode
  }: {
    chain: Chain
    walletIndex: number
    hdMode: HDMode
  }): LedgerAddressLD => {
    if (isThorChain(chain)) return addLedgerThorAddress(walletIndex, hdMode)
    if (isBnbChain(chain)) return addLedgerBnbAddress(walletIndex, hdMode)
    if (isBtcChain(chain)) return addLedgerBtcAddress(walletIndex, hdMode)
    if (isLtcChain(chain)) return addLedgerLtcAddress(walletIndex, hdMode)
    if (isBchChain(chain)) return addLedgerBchAddress(walletIndex, hdMode)
    if (isDogeChain(chain)) return addLedgerDOGEAddress(walletIndex, hdMode)
    if (isEthChain(chain)) return addLedgerEthAddress(walletIndex, hdMode)
    if (isAvaxChain(chain)) return addLedgerAvaxAddress(walletIndex, hdMode)
    if (isBscChain(chain)) return addLedgerBscAddress(walletIndex, hdMode)
    if (isCosmosChain(chain)) return addLedgerCosmosAddress(walletIndex, hdMode)
    if (isMayaChain(chain)) return addLedgerMayaAddress(walletIndex, hdMode)
    if (isDashChain(chain)) return addLedgerDashAddress(walletIndex, hdMode)

    return Rx.of(
      RD.failure({
        errorId: LedgerErrorId.GET_ADDRESS_FAILED,
        msg: `Adding Ledger for ${chain} has not been implemented`
      })
    )
  }

  const verifyLedgerAddressHandler = ({
    chain,
    walletIndex,
    hdMode
  }: {
    chain: Chain
    walletIndex: number
    hdMode: HDMode
  }): VerifiedLedgerAddressLD => {
    if (isThorChain(chain)) return verifyLedgerThorAddress(walletIndex, hdMode)
    if (isBnbChain(chain)) return verifyLedgerBnbAddress(walletIndex, hdMode)
    if (isBtcChain(chain)) return verifyLedgerBtcAddress(walletIndex, hdMode)
    if (isLtcChain(chain)) return verifyLedgerLtcAddress(walletIndex, hdMode)
    if (isBchChain(chain)) return verifyLedgerBchAddress(walletIndex, hdMode)
    if (isDogeChain(chain)) return verifyLedgerDOGEAddress(walletIndex, hdMode)
    if (isEthChain(chain)) return verifyLedgerEthAddress(walletIndex, hdMode)
    if (isAvaxChain(chain)) return verifyLedgerAvaxAddress(walletIndex, hdMode)
    if (isBscChain(chain)) return verifyLedgerBscAddress(walletIndex, hdMode)
    if (isCosmosChain(chain)) return verifyLedgerCosmosAddress(walletIndex, hdMode)
    if (isMayaChain(chain)) return verifyLedgerMayaAddress(walletIndex, hdMode)
    if (isDashChain(chain)) return verifyLedgerDashAddress(walletIndex, hdMode)

    return Rx.of(RD.failure(Error(`Ledger address verification for ${chain} has not been implemented`)))
  }

  const removeLedgerAddressHandler = (chain: Chain) => {
    if (isThorChain(chain)) return removeLedgerThorAddress()
    if (isBnbChain(chain)) return removeLedgerBnbAddress()
    if (isBtcChain(chain)) return removeLedgerBtcAddress()
    if (isLtcChain(chain)) return removeLedgerLtcAddress()
    if (isBchChain(chain)) return removeLedgerBchAddress()
    if (isDogeChain(chain)) return removeLedgerDOGEAddress()
    if (isEthChain(chain)) return removeLedgerEthAddress()
    if (isAvaxChain(chain)) return removeLedgerAvaxAddress()
    if (isBscChain(chain)) return removeLedgerBscAddress()
    if (isCosmosChain(chain)) return removeLedgerCosmosAddress()
    if (isMayaChain(chain)) return removeLedgerMayaAddress()
    if (isDashChain(chain)) return removeLedgerDashAddress()

    return FP.constVoid
  }

  const { clientByChain$ } = useChainContext()

  const oBNBClient = useObservableState(clientByChain$(BNBChain), O.none)
  const oETHClient = useObservableState(clientByChain$(ETHChain), O.none)
  const oAVAXClient = useObservableState(clientByChain$(AVAXChain), O.none)
  const oBSCClient = useObservableState(clientByChain$(BSCChain), O.none)
  const oBTCClient = useObservableState(clientByChain$(BTCChain), O.none)
  const oBCHClient = useObservableState(clientByChain$(BCHChain), O.none)
  const oTHORClient = useObservableState(clientByChain$(THORChain), O.none)
  const oLTCClient = useObservableState(clientByChain$(LTCChain), O.none)
  const oDOGEClient = useObservableState(clientByChain$(DOGEChain), O.none)
  const oCosmosClient = useObservableState(clientByChain$(GAIAChain), O.none)
  const oMayaClient = useObservableState(clientByChain$(MAYAChain), O.none)
  const oDashClient = useObservableState(clientByChain$(DASHChain), O.none)

  const clickAddressLinkHandler = (chain: Chain, address: Address) => {
    const openExplorerAddressUrl = (client: XChainClient) => {
      const url = client.getExplorerAddressUrl(address)
      console.log(url)
      window.apiUrl.openExternal(url)
    }

    if (!isEnabledChain(chain)) {
      console.warn(`${chain} is not supported for 'clickAddressLinkHandler'`)
    }

    switch (chain) {
      case BNBChain:
        FP.pipe(oBNBClient, O.map(openExplorerAddressUrl))
        break
      case BTCChain:
        FP.pipe(oBTCClient, O.map(openExplorerAddressUrl))
        break
      case BCHChain:
        FP.pipe(oBCHClient, O.map(openExplorerAddressUrl))
        break
      case ETHChain:
        FP.pipe(oETHClient, O.map(openExplorerAddressUrl))
        break
      case AVAXChain:
        FP.pipe(oAVAXClient, O.map(openExplorerAddressUrl))
        break
      case BSCChain:
        FP.pipe(oBSCClient, O.map(openExplorerAddressUrl))
        break
      case THORChain:
        FP.pipe(oTHORClient, O.map(openExplorerAddressUrl))
        break
      case LTCChain:
        FP.pipe(oLTCClient, O.map(openExplorerAddressUrl))
        break
      case DOGEChain:
        FP.pipe(oDOGEClient, O.map(openExplorerAddressUrl))
        break
      case GAIAChain:
        FP.pipe(oCosmosClient, O.map(openExplorerAddressUrl))
        break
      case MAYAChain:
        FP.pipe(oMayaClient, O.map(openExplorerAddressUrl))
        break
      case DASHChain:
        FP.pipe(oDashClient, O.map(openExplorerAddressUrl))
        break
    }
  }

  const walletAccounts$ = useMemo(() => {
    const thorWalletAccount$ = walletAccount$({
      addressUI$: thorAddressUI$,
      ledgerAddress: oThorLedgerWalletAddress,
      chain: THORChain
    })
    const btcWalletAccount$ = walletAccount$({
      addressUI$: btcAddressUI$,
      ledgerAddress: oBtcLedgerWalletAddress,
      chain: BTCChain
    })
    const ethWalletAccount$ = walletAccount$({
      addressUI$: ethAddressUI$,
      ledgerAddress: oEthLedgerWalletAddress,
      chain: ETHChain
    })
    const avaxWalletAccount$ = walletAccount$({
      addressUI$: avaxAddressUI$,
      ledgerAddress: oAvaxLedgerWalletAddress,
      chain: AVAXChain
    })
    const bscWalletAccount$ = walletAccount$({
      addressUI$: bscAddressUI$,
      ledgerAddress: oBscLedgerWalletAddress,
      chain: BSCChain
    })
    const bnbWalletAccount$ = walletAccount$({
      addressUI$: bnbAddressUI$,
      ledgerAddress: oBnbLedgerWalletAddress,
      chain: BNBChain
    })
    const bchWalletAccount$ = walletAccount$({
      addressUI$: bchAddressUI$,
      ledgerAddress: oBchLedgerWalletAddress,
      chain: BCHChain
    })
    const ltcWalletAccount$ = walletAccount$({
      addressUI$: ltcAddressUI$,
      ledgerAddress: oLtcLedgerWalletAddress,
      chain: LTCChain
    })
    const dogeWalletAccount$ = walletAccount$({
      addressUI$: dogeAddressUI$,
      ledgerAddress: oDogeLedgerWalletAddress,
      chain: DOGEChain
    })
    const cosmosWalletAccount$ = walletAccount$({
      addressUI$: cosmosAddressUI$,
      ledgerAddress: oCosmosLedgerWalletAddress,
      chain: GAIAChain
    })
    const mayaWalletAccount$ = walletAccount$({
      addressUI$: mayaAddressUI$,
      ledgerAddress: oMayaLedgerWalletAddress,
      chain: MAYAChain
    })
    const dashWalletAccount$ = walletAccount$({
      addressUI$: dashAddressUI$,
      ledgerAddress: oDashLedgerWalletAddress,
      chain: DASHChain
    })

    return FP.pipe(
      // combineLatest is for the future additional accounts
      Rx.combineLatest(
        filterEnabledChains({
          THOR: [thorWalletAccount$],
          BTC: [btcWalletAccount$],
          ETH: [ethWalletAccount$],
          AVAX: [avaxWalletAccount$],
          BSC: [bscWalletAccount$],
          BNB: [bnbWalletAccount$],
          BCH: [bchWalletAccount$],
          LTC: [ltcWalletAccount$],
          DOGE: [dogeWalletAccount$],
          GAIA: [cosmosWalletAccount$],
          MAYA: [mayaWalletAccount$],
          DASH: [dashWalletAccount$]
        })
      ),
      RxOp.map(A.filter(O.isSome)),
      RxOp.map(sequenceTOptionFromArray)
    )
  }, [
    thorAddressUI$,
    oThorLedgerWalletAddress,
    btcAddressUI$,
    oBtcLedgerWalletAddress,
    ethAddressUI$,
    oEthLedgerWalletAddress,
    avaxAddressUI$,
    oAvaxLedgerWalletAddress,
    bscAddressUI$,
    oBscLedgerWalletAddress,
    bnbAddressUI$,
    oBnbLedgerWalletAddress,
    bchAddressUI$,
    oBchLedgerWalletAddress,
    ltcAddressUI$,
    oLtcLedgerWalletAddress,
    dogeAddressUI$,
    oDogeLedgerWalletAddress,
    cosmosAddressUI$,
    oCosmosLedgerWalletAddress,
    mayaAddressUI$,
    oMayaLedgerWalletAddress,
    dashAddressUI$,
    oDashLedgerWalletAddress
  ])

  const walletAccounts = useObservableState(walletAccounts$, O.none)

  return (
    <WalletSettings
      network={network}
      lockWallet={lock}
      removeKeystoreWallet={remove}
      changeKeystoreWallet$={change$}
      renameKeystoreWallet$={rename$}
      exportKeystore={exportKeystore}
      addLedgerAddress$={addLedgerAddressHandler}
      verifyLedgerAddress$={verifyLedgerAddressHandler}
      removeLedgerAddress={removeLedgerAddressHandler}
      keystoreUnlocked={keystoreUnlocked}
      wallets={walletsUI}
      walletAccounts={walletAccounts}
      clickAddressLinkHandler={clickAddressLinkHandler}
      validatePassword$={validatePassword$}
      collapsed={collapsed}
      toggleCollapse={toggleCollapse}
      evmHDMode={evmHDMode}
      updateEvmHDMode={updateEvmHDMode}
    />
  )
}
