import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { XChainClient } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
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
import { isSupportedChain } from '../../../shared/utils/chain'
import { HDMode } from '../../../shared/wallet/types'
import { WalletSettings } from '../../components/settings'
import { useArbContext } from '../../contexts/ArbContext'
import { useAvaxContext } from '../../contexts/AvaxContext'
import { useBitcoinCashContext } from '../../contexts/BitcoinCashContext'
import { useBitcoinContext } from '../../contexts/BitcoinContext'
import { useBscContext } from '../../contexts/BscContext'
import { useChainContext } from '../../contexts/ChainContext'
import { useCosmosContext } from '../../contexts/CosmosContext'
import { useDashContext } from '../../contexts/DashContext'
import { useDogeContext } from '../../contexts/DogeContext'
import { useEthereumContext } from '../../contexts/EthereumContext'
import { useKujiContext } from '../../contexts/KujiContext'
import { useLitecoinContext } from '../../contexts/LitecoinContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import {
  filterEnabledChains,
  isBchChain,
  isDogeChain,
  isBtcChain,
  isLtcChain,
  isThorChain,
  isEthChain,
  isCosmosChain,
  isArbChain,
  isAvaxChain,
  isBscChain,
  isMayaChain,
  isDashChain,
  isKujiChain
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
  const { addressUI$: ethAddressUI$, ethHDMode$, updateEvmHDMode } = useEthereumContext()
  const { addressUI$: arbAddressUI$ } = useArbContext()
  const { addressUI$: avaxAddressUI$ } = useAvaxContext()
  const { addressUI$: bscAddressUI$ } = useBscContext()
  const { addressUI$: btcAddressUI$ } = useBitcoinContext()
  const { addressUI$: ltcAddressUI$ } = useLitecoinContext()
  const { addressUI$: bchAddressUI$ } = useBitcoinCashContext()
  const { addressUI$: dogeAddressUI$ } = useDogeContext()
  const { addressUI$: cosmosAddressUI$ } = useCosmosContext()
  const { addressUI$: mayaAddressUI$ } = useMayachainContext()
  const { addressUI$: dashAddressUI$ } = useDashContext()
  const { addressUI$: kujiAddressUI$ } = useKujiContext()

  const evmHDMode: EvmHDMode = useObservableState(ethHDMode$, DEFAULT_EVM_HD_MODE)

  const {
    addAddress: addLedgerThorAddress,
    verifyAddress: verifyLedgerThorAddress,
    address: oThorLedgerWalletAddress,
    removeAddress: removeLedgerThorAddress
  } = useLedger(THORChain, keystoreId)

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
    addAddress: addLedgerKujiAddress,
    verifyAddress: verifyLedgerKujiAddress,
    address: oKujiLedgerWalletAddress,
    removeAddress: removeLedgerKujiAddress
  } = useLedger(KUJIChain, keystoreId)

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
    addAddress: addLedgerArbAddress,
    verifyAddress: verifyLedgerArbAddress,
    address: oArbLedgerWalletAddress,
    removeAddress: removeLedgerArbAddress
  } = useLedger(ARBChain, keystoreId)
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
    walletAccount,
    walletIndex,
    hdMode
  }: {
    chain: Chain
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
  }): LedgerAddressLD => {
    if (isThorChain(chain)) return addLedgerThorAddress(walletAccount, walletIndex, hdMode)
    if (isBtcChain(chain)) return addLedgerBtcAddress(walletAccount, walletIndex, hdMode)
    if (isLtcChain(chain)) return addLedgerLtcAddress(walletAccount, walletIndex, hdMode)
    if (isBchChain(chain)) return addLedgerBchAddress(walletAccount, walletIndex, hdMode)
    if (isDogeChain(chain)) return addLedgerDOGEAddress(walletAccount, walletIndex, hdMode)
    if (isEthChain(chain)) return addLedgerEthAddress(walletAccount, walletIndex, hdMode)
    if (isArbChain(chain)) return addLedgerArbAddress(walletAccount, walletIndex, hdMode)
    if (isAvaxChain(chain)) return addLedgerAvaxAddress(walletAccount, walletIndex, hdMode)
    if (isBscChain(chain)) return addLedgerBscAddress(walletAccount, walletIndex, hdMode)
    if (isCosmosChain(chain)) return addLedgerCosmosAddress(walletAccount, walletIndex, hdMode)
    if (isMayaChain(chain)) return addLedgerMayaAddress(walletAccount, walletIndex, hdMode)
    if (isDashChain(chain)) return addLedgerDashAddress(walletAccount, walletIndex, hdMode)
    if (isKujiChain(chain)) return addLedgerKujiAddress(walletAccount, walletIndex, hdMode)

    return Rx.of(
      RD.failure({
        errorId: LedgerErrorId.GET_ADDRESS_FAILED,
        msg: `Adding Ledger for ${chain} has not been implemented`
      })
    )
  }

  const verifyLedgerAddressHandler = ({
    chain,
    walletAccount,
    walletIndex,
    hdMode
  }: {
    chain: Chain
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
  }): VerifiedLedgerAddressLD => {
    if (isThorChain(chain)) return verifyLedgerThorAddress(walletAccount, walletIndex, hdMode)
    if (isBtcChain(chain)) return verifyLedgerBtcAddress(walletAccount, walletIndex, hdMode)
    if (isLtcChain(chain)) return verifyLedgerLtcAddress(walletAccount, walletIndex, hdMode)
    if (isBchChain(chain)) return verifyLedgerBchAddress(walletAccount, walletIndex, hdMode)
    if (isDogeChain(chain)) return verifyLedgerDOGEAddress(walletAccount, walletIndex, hdMode)
    if (isEthChain(chain)) return verifyLedgerEthAddress(walletAccount, walletIndex, hdMode)
    if (isArbChain(chain)) return verifyLedgerArbAddress(walletAccount, walletIndex, hdMode)
    if (isAvaxChain(chain)) return verifyLedgerAvaxAddress(walletAccount, walletIndex, hdMode)
    if (isBscChain(chain)) return verifyLedgerBscAddress(walletAccount, walletIndex, hdMode)
    if (isCosmosChain(chain)) return verifyLedgerCosmosAddress(walletAccount, walletIndex, hdMode)
    if (isMayaChain(chain)) return verifyLedgerMayaAddress(walletAccount, walletIndex, hdMode)
    if (isDashChain(chain)) return verifyLedgerDashAddress(walletAccount, walletIndex, hdMode)
    if (isKujiChain(chain)) return verifyLedgerKujiAddress(walletAccount, walletIndex, hdMode)

    return Rx.of(RD.failure(Error(`Ledger address verification for ${chain} has not been implemented`)))
  }

  const removeLedgerAddressHandler = (chain: Chain) => {
    if (isThorChain(chain)) return removeLedgerThorAddress()
    if (isBtcChain(chain)) return removeLedgerBtcAddress()
    if (isLtcChain(chain)) return removeLedgerLtcAddress()
    if (isBchChain(chain)) return removeLedgerBchAddress()
    if (isDogeChain(chain)) return removeLedgerDOGEAddress()
    if (isEthChain(chain)) return removeLedgerEthAddress()
    if (isArbChain(chain)) return removeLedgerArbAddress()
    if (isAvaxChain(chain)) return removeLedgerAvaxAddress()
    if (isBscChain(chain)) return removeLedgerBscAddress()
    if (isCosmosChain(chain)) return removeLedgerCosmosAddress()
    if (isMayaChain(chain)) return removeLedgerMayaAddress()
    if (isDashChain(chain)) return removeLedgerDashAddress()
    if (isKujiChain(chain)) return removeLedgerKujiAddress()

    return FP.constVoid
  }

  const { clientByChain$ } = useChainContext()

  const oETHClient = useObservableState(clientByChain$(ETHChain), O.none)
  const oARBClient = useObservableState(clientByChain$(ARBChain), O.none)
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
  const oKujiClient = useObservableState(clientByChain$(KUJIChain), O.none)

  const clickAddressLinkHandler = (chain: Chain, address: Address) => {
    const openExplorerAddressUrl = (client: XChainClient) => {
      const url = client.getExplorerAddressUrl(address)
      window.apiUrl.openExternal(url)
    }

    if (!isSupportedChain(chain)) {
      console.warn(`${chain} is not supported for 'clickAddressLinkHandler'`)
    }

    switch (chain) {
      case BTCChain:
        FP.pipe(oBTCClient, O.map(openExplorerAddressUrl))
        break
      case BCHChain:
        FP.pipe(oBCHClient, O.map(openExplorerAddressUrl))
        break
      case ETHChain:
        FP.pipe(oETHClient, O.map(openExplorerAddressUrl))
        break
      case ARBChain:
        FP.pipe(oARBClient, O.map(openExplorerAddressUrl))
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
      case KUJIChain:
        FP.pipe(oKujiClient, O.map(openExplorerAddressUrl))
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
    const arbWalletAccount$ = walletAccount$({
      addressUI$: arbAddressUI$,
      ledgerAddress: oArbLedgerWalletAddress,
      chain: ARBChain
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
    const kujiWalletAccount$ = walletAccount$({
      addressUI$: kujiAddressUI$,
      ledgerAddress: oKujiLedgerWalletAddress,
      chain: KUJIChain
    })

    return FP.pipe(
      // combineLatest is for the future additional walletAccounts
      Rx.combineLatest(
        filterEnabledChains({
          THOR: [thorWalletAccount$],
          BTC: [btcWalletAccount$],
          ETH: [ethWalletAccount$],
          ARB: [arbWalletAccount$],
          AVAX: [avaxWalletAccount$],
          BSC: [bscWalletAccount$],
          BCH: [bchWalletAccount$],
          LTC: [ltcWalletAccount$],
          DOGE: [dogeWalletAccount$],
          GAIA: [cosmosWalletAccount$],
          MAYA: [mayaWalletAccount$],
          DASH: [dashWalletAccount$],
          KUJI: [kujiWalletAccount$]
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
    arbAddressUI$,
    oArbLedgerWalletAddress,
    avaxAddressUI$,
    oAvaxLedgerWalletAddress,
    bscAddressUI$,
    oBscLedgerWalletAddress,
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
    oDashLedgerWalletAddress,
    kujiAddressUI$,
    oKujiLedgerWalletAddress
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
