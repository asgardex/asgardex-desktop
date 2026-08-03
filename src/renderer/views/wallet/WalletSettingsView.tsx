import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { XChainClient } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { SUIChain } from '@xchainjs/xchain-sui'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { TRONChain } from '@xchainjs/xchain-tron'
import { Address, Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { function as FP, array as A, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { LedgerErrorId } from '../../../shared/api/types'
import { DEFAULT_EVM_HD_MODE, EvmHDMode } from '../../../shared/evm/types'
import { isSupportedChain } from '../../../shared/utils/chain'
import { HDMode } from '../../../shared/wallet/types'
import { WalletSettings } from '../../components/settings'
import { useAdaContext } from '../../contexts/AdaContext'
import { useArbContext } from '../../contexts/ArbContext'
import { useAvaxContext } from '../../contexts/AvaxContext'
import { useBaseContext } from '../../contexts/BaseContext'
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
import { useSolContext } from '../../contexts/SolContext'
import { useSuiContext } from '../../contexts/SuiContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useTronContext } from '../../contexts/TronContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { useXrdContext } from '../../contexts/XrdContext'
import { useXrpContext } from '../../contexts/XrpContext'
import { useZcashContext } from '../../contexts/ZcashContext'
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
  isBaseChain,
  isBscChain,
  isMayaChain,
  isDashChain,
  isXrdChain,
  isSolChain,
  isTronChain,
  isAdaChain,
  isZecChain,
  isXrpChain
} from '../../helpers/chainHelper'
import { sequenceTOptionFromArray } from '../../helpers/fpHelpers'
import { logger } from '../../helpers/logger'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import { useLedger } from '../../hooks/useLedger'
import { useNetwork } from '../../hooks/useNetwork'
import { LedgerAddressLD, KeystoreUnlocked, VerifiedLedgerAddressLD } from '../../services/wallet/types'
import { walletAccount$ } from './WalletSettingsView.helper'

type Props = {
  keystoreUnlocked: KeystoreUnlocked
}

export const WalletSettingsView = ({ keystoreUnlocked }: Props): JSX.Element => {
  const { id: keystoreId } = keystoreUnlocked

  const { walletsUI } = useKeystoreWallets()

  const {
    keystoreService: { exportKeystore, validatePassword$ }
  } = useWalletContext()

  const { lock, remove, change$, rename$ } = useKeystoreState()

  const { network } = useNetwork()

  const { address$: thorAddressUI$ } = useThorchainContext()
  const { addressUI$: ethAddressUI$, evmHDMode$, updateEvmHDMode } = useEthereumContext()
  const { addressUI$: arbAddressUI$ } = useArbContext()
  const { addressUI$: avaxAddressUI$ } = useAvaxContext()
  const { addressUI$: baseAddressUI$ } = useBaseContext()
  const { addressUI$: bscAddressUI$ } = useBscContext()
  const { addressUI$: btcAddressUI$, addressUITR$: btcAddressUITR$ } = useBitcoinContext()
  const { addressUI$: ltcAddressUI$ } = useLitecoinContext()
  const { addressUI$: bchAddressUI$ } = useBitcoinCashContext()
  const { addressUI$: dogeAddressUI$ } = useDogeContext()
  const { addressUI$: cosmosAddressUI$ } = useCosmosContext()
  const { addressUI$: mayaAddressUI$ } = useMayachainContext()
  const { addressUI$: dashAddressUI$ } = useDashContext()
  const { addressUI$: adaAddressUI$ } = useAdaContext()
  const { addressUI$: xrdAddressUI$ } = useXrdContext()
  const { addressUI$: solAddressUI$ } = useSolContext()
  const { addressUI$: tronAddressUI$ } = useTronContext()
  const { addressUI$: zecAddressUI$ } = useZcashContext()
  const { addressUI$: xrpAddressUI$ } = useXrpContext()
  const { addressUI$: suiAddressUI$ } = useSuiContext()

  const evmHDMode: EvmHDMode = useObservableState(evmHDMode$, DEFAULT_EVM_HD_MODE)

  const {
    addAddress: addLedgerThorAddress,
    verifyAddress: verifyLedgerThorAddress,
    address: oThorLedgerWalletAddress,
    removeAddress: removeLedgerThorAddress
  } = useLedger(THORChain, keystoreId)

  // BTC Ledger — Native SegWit (P2WPKH) slot. The `'p2wpkh'` scope also matches
  // legacy entries persisted with `hdMode: 'default'` via the normalization in
  // `wallet/ledger.ts`, so pre-existing wallets keep working.
  const {
    addAddress: addLedgerBtcAddress,
    verifyAddress: verifyLedgerBtcAddress,
    address: oBtcLedgerWalletAddress,
    removeAddress: removeLedgerBtcAddress
  } = useLedger(BTCChain, keystoreId, 'p2wpkh')

  // BTC Ledger — Taproot (P2TR) slot. Held independently so adding a Taproot
  // address no longer overwrites a previously-added Native SegWit one.
  const {
    addAddress: addLedgerBtcTaprootAddress,
    verifyAddress: verifyLedgerBtcTaprootAddress,
    address: oBtcLedgerTaprootWalletAddress,
    removeAddress: removeLedgerBtcTaprootAddress
  } = useLedger(BTCChain, keystoreId, 'p2tr')

  const {
    addAddress: addLedgerSolAddress,
    verifyAddress: verifyLedgerSolAddress,
    address: oSolLedgerWalletAddress,
    removeAddress: removeLedgerSolAddress
  } = useLedger(SOLChain, keystoreId)

  const {
    addAddress: addLedgerDashAddress,
    verifyAddress: verifyLedgerDashAddress,
    address: oDashLedgerWalletAddress,
    removeAddress: removeLedgerDashAddress
  } = useLedger(DASHChain, keystoreId)

  const {
    addAddress: addLedgerAdaAddress,
    verifyAddress: verifyLedgerAdaAddress,
    address: oAdaLedgerWalletAddress,
    removeAddress: removeLedgerAdaAddress
  } = useLedger(ADAChain, keystoreId)
  const {
    addAddress: addLedgerXrdAddress,
    verifyAddress: verifyLedgerXrdAddress,
    address: oXrdLedgerWalletAddress,
    removeAddress: removeLedgerXrdAddress
  } = useLedger(RadixChain, keystoreId)

  const {
    addAddress: addLedgerZecAddress,
    verifyAddress: verifyLedgerZecAddress,
    address: oZecLedgerWalletAddress,
    removeAddress: removeLedgerZecAddress
  } = useLedger(ZECChain, keystoreId)

  const {
    addAddress: addLedgerTronAddress,
    verifyAddress: verifyLedgerTronAddress,
    address: oTronLedgerWalletAddress,
    removeAddress: removeLedgerTronAddress
  } = useLedger(TRONChain, keystoreId)

  const {
    addAddress: addLedgerXrpAddress,
    verifyAddress: verifyLedgerXrpAddress,
    address: oXrpLedgerWalletAddress,
    removeAddress: removeLedgerXrpAddress
  } = useLedger(XRPChain, keystoreId)

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
    addAddress: addLedgerBaseAddress,
    verifyAddress: verifyLedgerBaseAddress,
    address: oBaseLedgerWalletAddress,
    removeAddress: removeLedgerBaseAddress
  } = useLedger(BASEChain, keystoreId)

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
    if (isBtcChain(chain))
      return hdMode === 'p2tr'
        ? addLedgerBtcTaprootAddress(walletAccount, walletIndex, hdMode)
        : addLedgerBtcAddress(walletAccount, walletIndex, hdMode)
    if (isLtcChain(chain)) return addLedgerLtcAddress(walletAccount, walletIndex, hdMode)
    if (isBchChain(chain)) return addLedgerBchAddress(walletAccount, walletIndex, hdMode)
    if (isDogeChain(chain)) return addLedgerDOGEAddress(walletAccount, walletIndex, hdMode)
    if (isEthChain(chain)) return addLedgerEthAddress(walletAccount, walletIndex, hdMode)
    if (isArbChain(chain)) return addLedgerArbAddress(walletAccount, walletIndex, hdMode)
    if (isBaseChain(chain)) return addLedgerBaseAddress(walletAccount, walletIndex, hdMode)
    if (isAvaxChain(chain)) return addLedgerAvaxAddress(walletAccount, walletIndex, hdMode)
    if (isBscChain(chain)) return addLedgerBscAddress(walletAccount, walletIndex, hdMode)
    if (isCosmosChain(chain)) return addLedgerCosmosAddress(walletAccount, walletIndex, hdMode)
    if (isMayaChain(chain)) return addLedgerMayaAddress(walletAccount, walletIndex, hdMode)
    if (isDashChain(chain)) return addLedgerDashAddress(walletAccount, walletIndex, hdMode)
    if (isAdaChain(chain)) return addLedgerAdaAddress(walletAccount, walletIndex, hdMode)
    if (isXrdChain(chain)) return addLedgerXrdAddress(walletAccount, walletIndex, hdMode)
    if (isZecChain(chain)) return addLedgerZecAddress(walletAccount, walletIndex, hdMode)
    if (isSolChain(chain)) return addLedgerSolAddress(walletAccount, walletIndex, hdMode)
    if (isTronChain(chain)) return addLedgerTronAddress(walletAccount, walletIndex, hdMode)
    if (isXrpChain(chain)) return addLedgerXrpAddress(walletAccount, walletIndex, hdMode)
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
    if (isBtcChain(chain))
      return hdMode === 'p2tr'
        ? verifyLedgerBtcTaprootAddress(walletAccount, walletIndex, hdMode)
        : verifyLedgerBtcAddress(walletAccount, walletIndex, hdMode)
    if (isLtcChain(chain)) return verifyLedgerLtcAddress(walletAccount, walletIndex, hdMode)
    if (isBchChain(chain)) return verifyLedgerBchAddress(walletAccount, walletIndex, hdMode)
    if (isDogeChain(chain)) return verifyLedgerDOGEAddress(walletAccount, walletIndex, hdMode)
    if (isEthChain(chain)) return verifyLedgerEthAddress(walletAccount, walletIndex, hdMode)
    if (isArbChain(chain)) return verifyLedgerArbAddress(walletAccount, walletIndex, hdMode)
    if (isAvaxChain(chain)) return verifyLedgerAvaxAddress(walletAccount, walletIndex, hdMode)
    if (isBaseChain(chain)) return verifyLedgerBaseAddress(walletAccount, walletIndex, hdMode)
    if (isBscChain(chain)) return verifyLedgerBscAddress(walletAccount, walletIndex, hdMode)
    if (isCosmosChain(chain)) return verifyLedgerCosmosAddress(walletAccount, walletIndex, hdMode)
    if (isMayaChain(chain)) return verifyLedgerMayaAddress(walletAccount, walletIndex, hdMode)
    if (isDashChain(chain)) return verifyLedgerDashAddress(walletAccount, walletIndex, hdMode)
    if (isAdaChain(chain)) return verifyLedgerAdaAddress(walletAccount, walletIndex, hdMode)
    if (isXrdChain(chain)) return verifyLedgerXrdAddress(walletAccount, walletIndex, hdMode)
    if (isZecChain(chain)) return verifyLedgerZecAddress(walletAccount, walletIndex, hdMode)
    if (isSolChain(chain)) return verifyLedgerSolAddress(walletAccount, walletIndex, hdMode)
    if (isTronChain(chain)) return verifyLedgerTronAddress(walletAccount, walletIndex, hdMode)
    if (isXrpChain(chain)) return verifyLedgerXrpAddress(walletAccount, walletIndex, hdMode)
    return Rx.of(RD.failure(Error(`Ledger address verification for ${chain} has not been implemented`)))
  }

  const removeLedgerAddressHandler = (chain: Chain, hdMode?: HDMode) => {
    if (isThorChain(chain)) return removeLedgerThorAddress()
    if (isBtcChain(chain)) return hdMode === 'p2tr' ? removeLedgerBtcTaprootAddress() : removeLedgerBtcAddress()
    if (isLtcChain(chain)) return removeLedgerLtcAddress()
    if (isBchChain(chain)) return removeLedgerBchAddress()
    if (isDogeChain(chain)) return removeLedgerDOGEAddress()
    if (isEthChain(chain)) return removeLedgerEthAddress()
    if (isArbChain(chain)) return removeLedgerArbAddress()
    if (isAvaxChain(chain)) return removeLedgerAvaxAddress()
    if (isBaseChain(chain)) return removeLedgerBaseAddress()
    if (isBscChain(chain)) return removeLedgerBscAddress()
    if (isCosmosChain(chain)) return removeLedgerCosmosAddress()
    if (isMayaChain(chain)) return removeLedgerMayaAddress()
    if (isDashChain(chain)) return removeLedgerDashAddress()
    if (isAdaChain(chain)) return removeLedgerAdaAddress()
    if (isXrdChain(chain)) return removeLedgerXrdAddress()
    if (isZecChain(chain)) return removeLedgerZecAddress()
    if (isSolChain(chain)) return removeLedgerSolAddress()
    if (isTronChain(chain)) return removeLedgerTronAddress()
    if (isXrpChain(chain)) return removeLedgerXrpAddress()

    return FP.constVoid
  }

  const { clientByChain$ } = useChainContext()

  const oETHClient = useObservableState(clientByChain$(ETHChain), O.none)
  const oARBClient = useObservableState(clientByChain$(ARBChain), O.none)
  const oAVAXClient = useObservableState(clientByChain$(AVAXChain), O.none)
  const oBASEClient = useObservableState(clientByChain$(BASEChain), O.none)
  const oBSCClient = useObservableState(clientByChain$(BSCChain), O.none)
  const oBTCClient = useObservableState(clientByChain$(BTCChain), O.none)
  const oBCHClient = useObservableState(clientByChain$(BCHChain), O.none)
  const oTHORClient = useObservableState(clientByChain$(THORChain), O.none)
  const oLTCClient = useObservableState(clientByChain$(LTCChain), O.none)
  const oDOGEClient = useObservableState(clientByChain$(DOGEChain), O.none)
  const oCosmosClient = useObservableState(clientByChain$(GAIAChain), O.none)
  const oMayaClient = useObservableState(clientByChain$(MAYAChain), O.none)
  const oDashClient = useObservableState(clientByChain$(DASHChain), O.none)
  const oAdaClient = useObservableState(clientByChain$(ADAChain), O.none)
  const oXrdClient = useObservableState(clientByChain$(RadixChain), O.none)
  const oSolClient = useObservableState(clientByChain$(SOLChain), O.none)
  const oTronClient = useObservableState(clientByChain$(TRONChain), O.none)
  const oZecClient = useObservableState(clientByChain$(ZECChain), O.none)
  const oXrpClient = useObservableState(clientByChain$(XRPChain), O.none)
  const oSuiClient = useObservableState(clientByChain$(SUIChain), O.none)

  const clickAddressLinkHandler = (chain: Chain, address: Address) => {
    const openExplorerAddressUrl = (client: XChainClient) => {
      const url = client.getExplorerAddressUrl(address)
      window.apiUrl.openExternal(url)
    }

    if (!isSupportedChain(chain)) {
      logger.warn(`${chain} is not supported for 'clickAddressLinkHandler'`)
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
      case BASEChain:
        FP.pipe(oBASEClient, O.map(openExplorerAddressUrl))
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
      case ADAChain:
        FP.pipe(oAdaClient, O.map(openExplorerAddressUrl))
        break
      case RadixChain:
        FP.pipe(oXrdClient, O.map(openExplorerAddressUrl))
        break
      case SOLChain:
        FP.pipe(oSolClient, O.map(openExplorerAddressUrl))
        break
      case TRONChain:
        FP.pipe(oTronClient, O.map(openExplorerAddressUrl))
        break
      case ZECChain:
        FP.pipe(oZecClient, O.map(openExplorerAddressUrl))
        break
      case XRPChain:
        FP.pipe(oXrpClient, O.map(openExplorerAddressUrl))
        break
      case SUIChain:
        FP.pipe(oSuiClient, O.map(openExplorerAddressUrl))
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
    // Second BTC slot for the Taproot (P2TR) keystore + Ledger pair so the
    // settings UI shows an independent add/verify/remove row for it instead of
    // sharing one row that gets silently overwritten by the latest derivation.
    const btcTaprootWalletAccount$ = walletAccount$({
      addressUI$: btcAddressUITR$,
      ledgerAddress: oBtcLedgerTaprootWalletAddress,
      chain: BTCChain
    })
    const solWalletAccount$ = walletAccount$({
      addressUI$: solAddressUI$,
      ledgerAddress: oSolLedgerWalletAddress,
      chain: SOLChain
    })
    const tronWalletAccount$ = walletAccount$({
      addressUI$: tronAddressUI$,
      ledgerAddress: oTronLedgerWalletAddress,
      chain: TRONChain
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
    const baseWalletAccount$ = walletAccount$({
      addressUI$: baseAddressUI$,
      ledgerAddress: oBaseLedgerWalletAddress,
      chain: BASEChain
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
    const adaWalletAccount$ = walletAccount$({
      addressUI$: adaAddressUI$,
      ledgerAddress: oAdaLedgerWalletAddress,
      chain: ADAChain
    })
    const xrdWalletAccount$ = walletAccount$({
      addressUI$: xrdAddressUI$,
      ledgerAddress: oXrdLedgerWalletAddress,
      chain: RadixChain
    })
    const zecWalletAccount$ = walletAccount$({
      addressUI$: zecAddressUI$,
      ledgerAddress: oZecLedgerWalletAddress,
      chain: ZECChain
    })
    const xrpWalletAccount$ = walletAccount$({
      addressUI$: xrpAddressUI$,
      ledgerAddress: oXrpLedgerWalletAddress,
      chain: XRPChain
    })
    const suiWalletAccount$ = walletAccount$({
      addressUI$: suiAddressUI$,
      ledgerAddress: O.none,
      chain: SUIChain
    })
    return FP.pipe(
      // combineLatest is for the future additional walletAccounts
      Rx.combineLatest(
        filterEnabledChains({
          THOR: [thorWalletAccount$],
          BTC: [btcWalletAccount$, btcTaprootWalletAccount$],
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
          ADA: [adaWalletAccount$],
          XRD: [xrdWalletAccount$],
          SOL: [solWalletAccount$],
          TRON: [tronWalletAccount$],
          BASE: [baseWalletAccount$],
          ZEC: [zecWalletAccount$],
          XRP: [xrpWalletAccount$],
          SUI: [suiWalletAccount$]
        })
      ),
      RxOp.map(A.filter(O.isSome)),
      RxOp.map(sequenceTOptionFromArray)
    )
  }, [
    thorAddressUI$,
    oThorLedgerWalletAddress,
    btcAddressUI$,
    btcAddressUITR$,
    oBtcLedgerWalletAddress,
    oBtcLedgerTaprootWalletAddress,
    solAddressUI$,
    oSolLedgerWalletAddress,
    tronAddressUI$,
    oTronLedgerWalletAddress,
    ethAddressUI$,
    oEthLedgerWalletAddress,
    arbAddressUI$,
    oArbLedgerWalletAddress,
    avaxAddressUI$,
    oAvaxLedgerWalletAddress,
    baseAddressUI$,
    oBaseLedgerWalletAddress,
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
    adaAddressUI$,
    oAdaLedgerWalletAddress,
    xrdAddressUI$,
    oXrdLedgerWalletAddress,
    zecAddressUI$,
    oZecLedgerWalletAddress,
    xrpAddressUI$,
    oXrpLedgerWalletAddress,
    suiAddressUI$
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
      evmHDMode={evmHDMode}
      updateEvmHDMode={updateEvmHDMode}
    />
  )
}
