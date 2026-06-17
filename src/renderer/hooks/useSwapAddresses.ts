import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { Address, AnyAsset, AssetType, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { lastValueFrom } from 'rxjs'

import { ASGARDEX_TO_SDK_CHAIN } from '../../shared/api/mpcTypes'
import { isLedgerWallet } from '../../shared/utils/guard'
import { HDMode, WalletType } from '../../shared/wallet/types'
import { useWalletContext } from '../contexts/WalletContext'
import { logger } from '../helpers/logger'
import { isStandaloneLedgerMode, isVultisigMode } from '../services/wallet/types'

type UseSwapAddressesParams = {
  sourceAsset: AnyAsset
  targetAsset: AnyAsset
  sourceKeystoreAddress: O.Option<Address>
  sourceLedgerAddress: O.Option<Address>
  targetKeystoreAddress: O.Option<Address>
  targetLedgerAddress: O.Option<Address>
  recipientAddress: O.Option<Address>
  initialSourceWalletType: WalletType
  initialTargetWalletType: O.Option<WalletType>
}

type UseSwapAddressesResult = {
  sourceAddress: O.Option<Address>
  sourceWalletType: WalletType
  destinationAddress: O.Option<Address>
  destinationAddressString: string
  useSourceLedger: boolean
  useSourceVultisig: boolean
  useTargetLedger: boolean
  quoteOnly: boolean
  setQuoteOnly: (v: boolean) => void
  targetWalletType: O.Option<WalletType>
  setTargetWalletType: (v: O.Option<WalletType>) => void
  // Standalone ledger target address
  standaloneLedgerTargetAddress: O.Option<Address>
  setStandaloneLedgerTargetAddress: (v: O.Option<Address>) => void
  fetchStandaloneLedgerTargetAddress: (chain: Chain) => Promise<void>
  isFetchingStandaloneLedgerAddress: boolean
  // Custom address editing state
  customAddressEditActive: boolean
  setCustomAddressEditActive: (v: boolean) => void
  // Target derivation path controls
  targetHDMode: HDMode
  setTargetHDMode: (v: HDMode) => void
  targetWalletAccount: number
  setTargetWalletAccount: (v: number) => void
  targetWalletIndex: number
  setTargetWalletIndex: (v: number) => void
}

export const useSwapAddresses = ({
  sourceAsset,
  targetAsset,
  sourceKeystoreAddress: oInitialSourceKeystoreAddress,
  sourceLedgerAddress: oSourceLedgerAddress,
  targetKeystoreAddress: _oTargetKeystoreAddress,
  targetLedgerAddress: _oTargetLedgerAddress,
  recipientAddress: oRecipientAddress,
  initialSourceWalletType,
  initialTargetWalletType: oInitialTargetWalletType
}: UseSwapAddressesParams): UseSwapAddressesResult => {
  const { appWalletService } = useWalletContext()
  const appWalletState = useObservableState(appWalletService.appWalletState$)

  const { chain: sourceChain } =
    sourceAsset.type === AssetType.SYNTH
      ? AssetCacao
      : sourceAsset.type === AssetType.SECURED
        ? AssetRuneNative
        : sourceAsset
  const { chain: targetChain } =
    targetAsset.type === AssetType.SYNTH
      ? AssetCacao
      : targetAsset.type === AssetType.SECURED
        ? AssetRuneNative
        : targetAsset

  // State for standalone ledger target address
  const [standaloneLedgerTargetAddress, setStandaloneLedgerTargetAddress] = useState<O.Option<Address>>(O.none)
  const [isFetchingStandaloneLedgerAddress, setIsFetchingStandaloneLedgerAddress] = useState(false)

  // Target derivation path parameters
  const [targetHDMode, setTargetHDMode] = useState<HDMode>('default')
  const [targetWalletAccount, setTargetWalletAccount] = useState<number>(0)
  const [targetWalletIndex, setTargetWalletIndex] = useState<number>(0)

  const [quoteOnly, setQuoteOnly] = useState<boolean>(false)
  const [customAddressEditActive, setCustomAddressEditActive] = useState(false)
  const [oTargetWalletType, setTargetWalletType] = useState<O.Option<WalletType>>(oInitialTargetWalletType)

  const lockedWallet = useObservableState(appWalletService.isLocked$, true)

  // Set default HD mode based on target chain
  useEffect(() => {
    if (targetAsset.chain === 'BTC') {
      setTargetHDMode('p2wpkh')
    } else if (['LTC', 'BCH', 'DASH', 'DOGE'].includes(targetAsset.chain)) {
      setTargetHDMode('default')
    } else if (['ETH', 'BSC', 'AVAX', 'ARB', 'BASE'].includes(targetAsset.chain)) {
      setTargetHDMode('ledgerlive')
    } else {
      setTargetHDMode('default')
    }
  }, [targetAsset.chain])

  // Update target wallet type when initial changes
  useEffect(() => {
    setTargetWalletType(oInitialTargetWalletType)
  }, [oInitialTargetWalletType])

  // Reset target address for standalone ledger mode when target chain changes
  const prevTargetChainRef = useRef<Chain | undefined>()
  useEffect(() => {
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      if (prevTargetChainRef.current && prevTargetChainRef.current !== targetChain) {
        setStandaloneLedgerTargetAddress(O.none)
      }
      prevTargetChainRef.current = targetChain
    }
  }, [appWalletState, targetChain])

  // Fetch target address for standalone ledger mode
  const fetchStandaloneLedgerTargetAddress = useCallback(
    async (chain: Chain) => {
      if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
        setIsFetchingStandaloneLedgerAddress(true)
        try {
          const addressResult = await lastValueFrom(
            appWalletService.standaloneLedgerService
              .getAddressWithoutStateChange(chain, targetHDMode, targetWalletAccount, targetWalletIndex)
              .pipe()
          )

          if (RD.isSuccess(addressResult)) {
            setStandaloneLedgerTargetAddress(O.some(addressResult.value.address))
          } else {
            setStandaloneLedgerTargetAddress(O.none)
          }
        } catch (error) {
          logger.error('[useSwapAddresses] Failed to fetch standalone ledger address', error)
          setStandaloneLedgerTargetAddress(O.none)
        } finally {
          setIsFetchingStandaloneLedgerAddress(false)
        }
      }
    },
    [appWalletState, appWalletService, targetHDMode, targetWalletAccount, targetWalletIndex]
  )

  const useSourceLedger = useMemo(() => {
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) return true
    return isLedgerWallet(initialSourceWalletType)
  }, [appWalletState, initialSourceWalletType])

  const useSourceVultisig = useMemo(() => (appWalletState && isVultisigMode(appWalletState)) || false, [appWalletState])

  const useTargetLedger = FP.pipe(
    oTargetWalletType,
    O.map(isLedgerWallet),
    O.getOrElse(() => false)
  )

  // Resolve source wallet address: Ledger → Vultisig → Keystore
  const sourceAddress = useMemo(() => {
    if (useSourceLedger) return oSourceLedgerAddress
    if (appWalletState && isVultisigMode(appWalletState)) {
      const sdkChain = ASGARDEX_TO_SDK_CHAIN[sourceChain]
      const addr = sdkChain ? appWalletState.addresses[sdkChain] : undefined
      return addr ? O.some(addr) : O.none
    }
    return oInitialSourceKeystoreAddress
  }, [useSourceLedger, oSourceLedgerAddress, appWalletState, sourceChain, oInitialSourceKeystoreAddress])

  // Auto-select chain for standalone ledger
  useEffect(() => {
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      const isChainConnected = appWalletState.connectedChain === sourceAsset.chain
      if (!isChainConnected) {
        appWalletService.standaloneLedgerService.setSelectedChain(sourceAsset.chain)
      }
    }
  }, [
    useSourceLedger,
    oSourceLedgerAddress,
    oInitialSourceKeystoreAddress,
    sourceAddress,
    sourceAsset.chain,
    appWalletState,
    appWalletService.standaloneLedgerService
  ])

  const sourceWalletType: WalletType = useMemo(() => {
    if (useSourceLedger) return WalletType.Ledger
    return initialSourceWalletType
  }, [useSourceLedger, initialSourceWalletType])

  // Compute effective recipient address: standalone ledger → Vultisig vault → provided recipient
  const destinationAddress: O.Option<Address> = useMemo(() => {
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      return standaloneLedgerTargetAddress
    }
    if (appWalletState && isVultisigMode(appWalletState) && O.isNone(oRecipientAddress)) {
      const sdkChain = ASGARDEX_TO_SDK_CHAIN[targetChain]
      const addr = sdkChain ? appWalletState.addresses[sdkChain] : undefined
      return addr ? O.some(addr) : O.none
    }
    return oRecipientAddress
  }, [appWalletState, standaloneLedgerTargetAddress, oRecipientAddress, targetChain])

  const destinationAddressString = useMemo(
    () =>
      FP.pipe(
        destinationAddress,
        O.fold(
          () => '',
          (address) => address
        )
      ),
    [destinationAddress]
  )

  // Auto-switch from "Preview Only" to "Preview & Swap" when recipient address is available
  useEffect(() => {
    if (quoteOnly && O.isSome(destinationAddress)) {
      setQuoteOnly(false)
    }
  }, [destinationAddress, quoteOnly])

  // Set quoteOnly if wallet is locked
  useEffect(() => {
    if (lockedWallet) {
      setQuoteOnly(true)
    }
  }, [lockedWallet])

  return {
    sourceAddress,
    sourceWalletType,
    destinationAddress,
    destinationAddressString,
    useSourceLedger,
    useSourceVultisig,
    useTargetLedger,
    quoteOnly,
    setQuoteOnly,
    targetWalletType: oTargetWalletType,
    setTargetWalletType,
    standaloneLedgerTargetAddress,
    setStandaloneLedgerTargetAddress,
    fetchStandaloneLedgerTargetAddress,
    isFetchingStandaloneLedgerAddress,
    customAddressEditActive,
    setCustomAddressEditActive,
    targetHDMode,
    setTargetHDMode,
    targetWalletAccount,
    setTargetWalletAccount,
    targetWalletIndex,
    setTargetWalletIndex
  }
}
