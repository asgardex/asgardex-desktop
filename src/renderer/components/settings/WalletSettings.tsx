import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import {
  TrashIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  QrCodeIcon,
  ArrowUpRightIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { Network } from '@xchainjs/xchain-client'
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
import { Asset, Address, Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import clsx from 'clsx'
import { function as FP, array as A, option as O } from 'fp-ts'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { SDK_TO_ASGARDEX_CHAIN } from '../../../shared/api/mpcTypes'
import { KeystoreId, TrustedAddress, TrustedAddresses } from '../../../shared/api/types'
import { getDerivationPath as getEvmDerivationPath } from '../../../shared/evm/ledger'
import { EvmHDMode } from '../../../shared/evm/types'
import { chainToString, EnabledChain, isSupportedChain } from '../../../shared/utils/chain'
import {
  getChainDerivationPath,
  getChainDerivationOptions,
  chainSupportsMultipleDerivationPaths
} from '../../../shared/utils/derivationPath'
import { isError } from '../../../shared/utils/guard'
import { HDMode, WalletAddress, WalletType } from '../../../shared/wallet/types'
import RemoveIcon from '../../assets/svg/icon-remove.svg?react'
import { WalletPasswordConfirmationModal } from '../../components/modal/confirmation'
import { RemoveWalletConfirmationModal } from '../../components/modal/confirmation/RemoveWalletConfirmationModal'
import { QRCodeModal } from '../../components/uielements/qrCodeModal/QRCodeModal'
import { RadioGroup, Radio } from '../../components/uielements/radio'
import { PhraseCopyModal } from '../../components/wallet/phrase/PhraseCopyModal'
import { getChainAsset } from '../../helpers/chainHelper'
import { isEvmChain } from '../../helpers/evmHelper'
import { eqChain, eqString } from '../../helpers/fp/eq'
import { emptyString } from '../../helpers/stringHelper'
import { getWalletNamesFromKeystoreWallets, isEnabledLedger } from '../../helpers/walletHelper'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import * as appRoutes from '../../routes/app'
import * as walletRoutes from '../../routes/wallet'
import { userAddresses$, addAddress, removeAddress } from '../../services/storage/userAddresses'
import { userChains$, addChain, removeChain } from '../../services/storage/userChains'
import {
  KeystoreWalletsUI,
  RemoveKeystoreWalletHandler,
  ValidatePasswordHandler,
  WalletAccounts,
  KeystoreUnlocked,
  ChangeKeystoreWalletHandler,
  ChangeKeystoreWalletRD,
  RenameKeystoreWalletHandler,
  RenameKeystoreWalletRD,
  VerifiedLedgerAddressLD,
  LedgerAddressRD,
  LedgerAddressLD,
  VerifiedLedgerAddressRD,
  VultisigState,
  VultisigVaultInfo
} from '../../services/wallet/types'
import { ledgerErrorIdToI18n, walletTypeToI18n } from '../../services/wallet/util'
import { useApp } from '../../store/app/hooks'
import { AddressEllipsis } from '../uielements/addressEllipsis'
import { ChainIcon } from '../uielements/assets/chainIcon/ChainIcon'
import { FlatButton, Button } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { WalletTypeLabel } from '../uielements/common'
import { Dropdown } from '../uielements/dropdown'
import { InfoIcon } from '../uielements/info'
import { Input, InputSearch } from '../uielements/input'
import { Label } from '../uielements/label'
import { Modal } from '../uielements/modal'
import { Tooltip } from '../uielements/tooltip'
import { WalletSelector } from '../uielements/wallet'
import { EditableWalletName } from '../uielements/wallet/EditableWalletName'
import { AutoComplete } from './AutoComplete'
import { WalletIndexInput } from './WalletIndexInput'
import { WhitelistModal } from './WhitelistModal'

// Convert derivation path index to HDMode for chains that support multiple paths
const derivationIndexToHDMode = (chain: Chain, index: number): HDMode => {
  if (chain === BTCChain) {
    switch (index) {
      case 0:
        return 'p2wpkh'
      case 1:
        return 'p2tr'
      default:
        return 'p2wpkh'
    }
  }
  // For EVM chains, the HDMode is handled separately via evmHDMode
  // For other UTXO chains, default to p2wpkh
  if (chain === BCHChain || chain === LTCChain || chain === DOGEChain || chain === DASHChain) {
    return 'p2wpkh'
  }
  return 'default'
}

const ActionButton = ({
  className,
  icon,
  text,
  onClick
}: {
  className?: string
  icon?: React.ReactNode
  text: string
  onClick: () => void
}) => {
  return (
    <div
      className={clsx(
        'flex min-w-[128px] cursor-pointer flex-col items-center',
        'space-y-2 px-4 py-2',
        'rounded-lg border border-solid border-gray1 dark:border-gray1d',
        'text-text2 dark:text-text2d',
        'hover:bg-bg2 dark:hover:bg-bg2d',
        className
      )}
      onClick={onClick}>
      {icon}
      <span>{text}</span>
    </div>
  )
}

// Common props shared by both keystore and vultisig modes
type CommonProps = {
  network: Network
  wallets: KeystoreWalletsUI
  lockWallet: FP.Lazy<void>
  clickAddressLinkHandler: (chain: Chain, address: Address) => void
  validatePassword$: ValidatePasswordHandler
}

// Keystore-specific props (walletMode defaults to Keystore for backwards compatibility)
type KeystoreProps = CommonProps & {
  walletMode?: WalletType.Keystore
  walletAccounts: O.Option<WalletAccounts>
  keystoreUnlocked: KeystoreUnlocked
  removeKeystoreWallet: RemoveKeystoreWalletHandler
  changeKeystoreWallet$: ChangeKeystoreWalletHandler
  renameKeystoreWallet$: RenameKeystoreWalletHandler
  exportKeystore: () => Promise<void>
  addLedgerAddress$: (params: {
    chain: Chain
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
  }) => LedgerAddressLD
  verifyLedgerAddress$: (params: {
    chain: Chain
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
  }) => VerifiedLedgerAddressLD
  removeLedgerAddress: (chain: Chain, hdMode?: HDMode) => void
  evmHDMode: EvmHDMode
  updateEvmHDMode: (mode: EvmHDMode) => void
}

// Vultisig-specific props
type VultisigProps = CommonProps & {
  walletMode: WalletType.Vultisig
  vultisigState: VultisigState
  vultisigVaults: VultisigVaultInfo[]
  activeVaultId: string | null
  removeVault: (vaultId: string) => Promise<void>
  renameVault: (vaultId: string, newName: string) => Promise<void>
  exportVault: (vaultId: string) => Promise<void>
  changeVault: (vaultId: string) => Promise<void>
}

type Props = KeystoreProps | VultisigProps

// Type guard matching existing project pattern (isVultisigMode, isKeystoreMode, etc.)
const isVultisigWalletProps = (p: Props): p is VultisigProps => p.walletMode === WalletType.Vultisig

type AddressToVerify = O.Option<{ address: Address; chain: Chain; hdMode: HDMode }>

const initialMap = {
  [BTCChain]: 0,
  [BCHChain]: 0,
  [LTCChain]: 0,
  [THORChain]: 0,
  [ETHChain]: 0,
  [GAIAChain]: 0,
  [DOGEChain]: 0,
  [AVAXChain]: 0,
  [BASEChain]: 0,
  [BSCChain]: 0,
  [MAYAChain]: 0,
  [DASHChain]: 0,
  [ARBChain]: 0,
  [RadixChain]: 0,
  [SOLChain]: 0,
  [ADAChain]: 0,
  [ZECChain]: 0,
  [XRPChain]: 0,
  [TRONChain]: 0,
  [SUIChain]: 0
}

export const WalletSettings = (props: Props): JSX.Element => {
  const isVultisig = isVultisigWalletProps(props)

  // Common props
  const { network, wallets, lockWallet, clickAddressLinkHandler, validatePassword$ } = props

  // Keystore-specific props (type guard narrows props — no double-check needed)
  const oWalletAccounts = !isVultisig ? props.walletAccounts : O.none
  const removeKeystoreWallet = !isVultisig ? props.removeKeystoreWallet : undefined
  const changeKeystoreWallet$ = !isVultisig ? props.changeKeystoreWallet$ : undefined
  const renameKeystoreWallet$ = !isVultisig ? props.renameKeystoreWallet$ : undefined
  const exportKeystore = !isVultisig ? props.exportKeystore : undefined
  const addLedgerAddress$ = !isVultisig ? props.addLedgerAddress$ : undefined
  const verifyLedgerAddress$ = !isVultisig ? props.verifyLedgerAddress$ : undefined
  const removeLedgerAddress = !isVultisig ? props.removeLedgerAddress : undefined
  const evmHDMode = !isVultisig ? props.evmHDMode : ('ledgerlive' as EvmHDMode)
  const updateEvmHDMode = !isVultisig ? props.updateEvmHDMode : undefined

  // Keystore identity
  const walletName = !isVultisig ? props.keystoreUnlocked.name : (props.vultisigState.activeVault?.name ?? 'Vault')
  const walletId = !isVultisig ? props.keystoreUnlocked.id : -1
  const phrase = !isVultisig ? props.keystoreUnlocked.phrase : ''

  // Vultisig-specific props
  const vultisigState = isVultisig ? props.vultisigState : undefined
  const vultisigVaults = isVultisig ? props.vultisigVaults : []
  const activeVaultId = isVultisig ? props.activeVaultId : null

  const { isWhitelistModalOpen, setIsWhitelistModalOpen } = useApp()

  const intl = useIntl()
  const navigate = useNavigate()

  const [showPhraseModal, setShowPhraseModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showRemoveWalletModal, setShowRemoveWalletModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState<O.Option<{ asset: Asset; address: Address }>>(O.none)
  const closeQrModal = useCallback(() => setShowQRModal(O.none), [setShowQRModal])

  // Destructure vultisig-specific props for stable callback references
  const vultisigRemoveVault = isVultisig ? props.removeVault : undefined
  const vultisigActiveVaultId = isVultisig ? props.activeVaultId : null
  const vultisigExportVault = isVultisig ? props.exportVault : undefined
  const vultisigChangeVault = isVultisig ? props.changeVault : undefined
  const vultisigRenameVault = isVultisig ? props.renameVault : undefined

  const removeWalletHandler = useCallback(async () => {
    if (vultisigRemoveVault && vultisigActiveVaultId) {
      // Delete vault and exit vultisig mode — unified wallet picker handles what's next
      await vultisigRemoveVault(vultisigActiveVaultId)
    } else if (removeKeystoreWallet) {
      await removeKeystoreWallet()
    }
    // Navigate based on remaining wallets (keystore + vultisig)
    if (wallets.length >= 1) {
      // Other wallets exist — go to unlock screen
      navigate(walletRoutes.locked.path())
    } else {
      // No wallets left — go to homepage
      navigate(appRoutes.base.template)
    }
  }, [vultisigRemoveVault, vultisigActiveVaultId, removeKeystoreWallet, wallets.length, navigate])

  const onSuccessPassword = useCallback(() => {
    setShowPasswordModal(false)
    setShowPhraseModal(true)
  }, [setShowPasswordModal, setShowPhraseModal])

  const renderQRCodeModal = useMemo(() => {
    return FP.pipe(
      showQRModal,
      O.map(({ asset, address }) => (
        <QRCodeModal
          key="qr-modal"
          asset={asset}
          address={address}
          network={network}
          visible={true}
          onCancel={closeQrModal}
          onOk={closeQrModal}
        />
      )),
      O.getOrElse(() => <></>)
    )
  }, [showQRModal, network, closeQrModal])

  // Keyed by row (`${chain}-${type}-${address}`), not by chain — BTC can render
  // two rows (Native SegWit + Taproot) which must not share their add-form state.
  const [walletIndexMap, setWalletIndexMap] = useState<Record<string, number>>(initialMap)
  const [derivationPathIndex, setDerivationPathIndex] = useState<Record<string, number>>(initialMap)
  const [walletAccountMap, setWalletAccountMap] = useState<Record<string, number>>(initialMap)

  const {
    state: verifyLedgerAddressRD,
    reset: resetVerifyLedgerAddressRD,
    subscribe: subscribeVerifyLedgerAddressRD
  } = useSubscriptionState<VerifiedLedgerAddressRD>(RD.initial)

  useEffect(() => {
    if (RD.isSuccess(verifyLedgerAddressRD)) {
      setLedgerAddressToVerify(O.none)
      resetVerifyLedgerAddressRD()
    }
  }, [verifyLedgerAddressRD, resetVerifyLedgerAddressRD])

  const [ledgerAddressToVerify, setLedgerAddressToVerify] = useState<AddressToVerify>(O.none)

  const renderLedgerNotSupported = useMemo(
    () => (
      <div className="mt-10px w-full">
        <WalletTypeLabel className="ml-10 inline-block">{walletTypeToI18n(WalletType.Ledger, intl)}</WalletTypeLabel>
        <div className="ml-40px flex items-center pt-5px text-[12px] text-text2 uppercase dark:text-text2d">
          <ExclamationTriangleIcon className="mr-2" width={24} height={24} />
          {intl.formatMessage({ id: 'common.notsupported.fornetwork' }, { network })}
        </div>
      </div>
    ),
    [intl, network]
  )

  const {
    state: addLedgerAddressRD,
    reset: resetAddLedgerAddressRD,
    subscribe: subscribeAddLedgerAddressRD
  } = useSubscriptionState<LedgerAddressRD>(RD.initial)

  const [ledgerChainToAdd, setLedgerChainToAdd] = useState<O.Option<Chain>>(O.none)

  const addLedgerAddress = useCallback(
    (chain: Chain, walletAccount: number, walletIndex: number, derivationIndex: number) => {
      if (!addLedgerAddress$) return // Guard: Ledger not available in Vultisig mode
      resetAddLedgerAddressRD()
      setLedgerChainToAdd(O.some(chain))

      let hdMode: HDMode = 'default'
      if (isEvmChain(chain)) {
        hdMode = evmHDMode
      } else if (chainSupportsMultipleDerivationPaths(chain)) {
        hdMode = derivationIndexToHDMode(chain, derivationIndex)
      }

      subscribeAddLedgerAddressRD(
        addLedgerAddress$({
          chain,
          walletAccount,
          walletIndex,
          hdMode
        })
      )
    },
    [addLedgerAddress$, resetAddLedgerAddressRD, subscribeAddLedgerAddressRD, evmHDMode]
  )

  const verifyLedgerAddressHandler = useCallback(
    (walletAddress: WalletAddress) => {
      if (!verifyLedgerAddress$) return // Guard: Ledger not available in Vultisig mode
      const { chain, walletAccount, walletIndex, address, hdMode } = walletAddress
      setLedgerAddressToVerify(O.some({ chain, address, hdMode }))
      subscribeVerifyLedgerAddressRD(
        verifyLedgerAddress$({
          chain,
          walletAccount,
          walletIndex,
          hdMode
        })
      )
    },
    [verifyLedgerAddress$, subscribeVerifyLedgerAddressRD]
  )

  const renderLedgerAddress = useCallback(
    (chain: EnabledChain, oAddress: O.Option<WalletAddress>, rowKey: string) => {
      const renderAddAddress = () => {
        const onChangeEvmDerivationMode = (evmMode: EvmHDMode) => {
          updateEvmHDMode?.(evmMode)
        }
        const selectedAccountIndex = walletAccountMap[rowKey] ?? 0
        const selectedWalletIndex = walletIndexMap[rowKey] ?? 0
        const selectedDerivationIndex = derivationPathIndex[rowKey] ?? 0

        // check
        const currentLedgerToAdd: boolean = FP.pipe(
          ledgerChainToAdd,
          O.map((c) => eqChain.equals(chain, c)),
          O.getOrElse(() => false)
        )
        const loading = currentLedgerToAdd && RD.isPending(addLedgerAddressRD)
        const empty = () => <></>
        const renderError = FP.pipe(
          addLedgerAddressRD,
          RD.fold(
            empty,
            empty,
            (error) => (
              <p className="pt-10px font-main text-[12px] text-error0 uppercase">
                {ledgerErrorIdToI18n(error.errorId, intl)}
              </p>
            ),
            empty
          )
        )

        const addLedgerAddressHandler = () => {
          addLedgerAddress(chain, selectedAccountIndex, selectedWalletIndex, selectedDerivationIndex)
        }

        return (
          <>
            <div className="flex w-full flex-col md:w-auto lg:flex-row">
              <div className="mr-30px flex items-center md:mr-0">
                <Button
                  className="cursor-pointer gap-x-1 !p-0 text-[12px]"
                  sizevalue="small"
                  loading={loading}
                  typevalue="transparent"
                  onClick={addLedgerAddressHandler}>
                  <PlusCircleIcon className="text-turquoise" width={20} height={20} />
                  {intl.formatMessage({ id: 'ledger.add.device' })}
                </Button>

                <>
                  <div className="ml-2 text-[12px] text-text2 uppercase dark:text-text2d">
                    {intl.formatMessage({ id: 'settings.wallet.account' })}
                  </div>
                  <WalletIndexInput
                    className="mr-1 ml-2 w-16"
                    value={selectedAccountIndex.toString()}
                    disabled={loading || (isEvmChain(chain) && evmHDMode !== 'ledgerlive')}
                    onChange={(value) => {
                      if (value !== null && +value >= 0) setWalletAccountMap({ ...walletAccountMap, [rowKey]: +value })
                    }}
                    onPressEnter={addLedgerAddressHandler}
                  />
                  <InfoIcon tooltip={intl.formatMessage({ id: 'settings.wallet.account.info' })} />

                  <div className="ml-2 text-[12px] text-text2 uppercase dark:text-text2d">
                    {intl.formatMessage({ id: 'settings.wallet.index' })}
                  </div>
                  <WalletIndexInput
                    className="mr-1 ml-2 w-16"
                    value={selectedWalletIndex.toString()}
                    onChange={(value) =>
                      value !== null && +value >= 0 && setWalletIndexMap({ ...walletIndexMap, [rowKey]: +value })
                    }
                    disabled={loading}
                    onPressEnter={addLedgerAddressHandler}
                  />
                  <InfoIcon tooltip={intl.formatMessage({ id: 'settings.wallet.index.info' })} />
                </>

                {/* Show derivation path for chains with multiple options (non-EVM) */}
                {chainSupportsMultipleDerivationPaths(chain) && !isEvmChain(chain) && (
                  <div className="ml-2">
                    <Dropdown
                      trigger={
                        <Label className="rounded-lg border border-solid border-bg2 p-2 dark:border-bg2d">
                          {getChainDerivationOptions(chain, selectedAccountIndex, selectedWalletIndex, network)[
                            selectedDerivationIndex
                          ]?.description || 'Default'}
                        </Label>
                      }
                      options={getChainDerivationOptions(chain, selectedAccountIndex, selectedWalletIndex, network).map(
                        (option, index: number) => (
                          <Label
                            key={option.path}
                            className="px-1"
                            size="normal"
                            onClick={() => setDerivationPathIndex({ ...derivationPathIndex, [rowKey]: index })}>
                            {option.description}
                          </Label>
                        )
                      )}
                    />
                  </div>
                )}

                {/* Show derivation path for chains with single path */}
                {!chainSupportsMultipleDerivationPaths(chain) && !isEvmChain(chain) && (
                  <div className="ml-2 text-[12px] text-text2 dark:text-text2d">
                    {getChainDerivationPath(chain, selectedAccountIndex, selectedWalletIndex, network).description}
                  </div>
                )}
              </div>
              {isEvmChain(chain) && (
                <RadioGroup
                  className="flex flex-col items-start lg:flex-row lg:items-center lg:space-x-2 lg:pl-30px"
                  onChange={onChangeEvmDerivationMode}
                  value={evmHDMode}>
                  <Radio value="ledgerlive" key="ledgerlive">
                    <Label className="mt-10px flex items-center lg:mt-0" textTransform="uppercase">
                      {intl.formatMessage({ id: 'common.ledgerlive' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'settings.wallet.hdpath.ledgerlive.info' },
                          {
                            path: `${getEvmDerivationPath(selectedAccountIndex, 'ledgerlive')}{index}`
                          }
                        )}
                      />
                    </Label>
                  </Radio>
                  <Radio value="legacy" key="legacy">
                    <Label className="mt-10px flex items-center lg:mt-0" textTransform="uppercase">
                      {intl.formatMessage({ id: 'common.legacy' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'settings.wallet.hdpath.legacy.info' },
                          { path: `${getEvmDerivationPath(selectedAccountIndex, 'legacy')}{index}` }
                        )}
                      />
                    </Label>
                  </Radio>
                  <Radio value="metamask" key="metamask">
                    <Label className="mt-10px flex items-center lg:mt-0" textTransform="uppercase">
                      {intl.formatMessage({ id: 'common.metamask' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'settings.wallet.hdpath.metamask.info' },
                          { path: `${getEvmDerivationPath(selectedAccountIndex, 'metamask')}{index}` }
                        )}
                      />
                    </Label>
                  </Radio>
                </RadioGroup>
              )}
            </div>
            {currentLedgerToAdd && renderError}
          </>
        )
      }

      const renderAddress = (walletAddress: WalletAddress) => {
        const { address, chain } = walletAddress
        return (
          <>
            <div className="flex w-full items-center gap-x-1">
              <AddressEllipsis
                address={address}
                chain={chain}
                network={network}
                enableCopy={true}
                className="max-w-full overflow-hidden font-main text-base text-text1 only:mx-auto dark:text-text1d"
              />
              <QrCodeIcon
                className="cursor-pointer text-turquoise"
                width={20}
                height={20}
                onClick={() => setShowQRModal(O.some({ asset: getChainAsset(chain), address }))}
              />
              <Tooltip
                title={intl.formatMessage({
                  id: 'wallet.ledger.viewAddress'
                })}>
                <ArrowUpRightIcon
                  className="cursor-pointer text-turquoise"
                  width={20}
                  height={20}
                  onClick={() => clickAddressLinkHandler(chain, address)}
                />
              </Tooltip>
              <Tooltip
                title={intl.formatMessage(
                  {
                    id: 'wallet.ledger.verifyAddress.modal.description'
                  },
                  { address }
                )}>
                <EyeIcon
                  className="cursor-pointer text-turquoise"
                  width={20}
                  height={20}
                  onClick={() => verifyLedgerAddressHandler(walletAddress)}
                />
              </Tooltip>
              <Tooltip
                title={intl.formatMessage(
                  {
                    id: 'wallet.ledger.removeAddress'
                  },
                  { chain }
                )}>
                <RemoveIcon className="h-4 w-4" onClick={() => removeLedgerAddress?.(chain, walletAddress.hdMode)} />
              </Tooltip>
            </div>
          </>
        )
      }
      const renderAccount = (walletAddress: WalletAddress) => {
        const { walletAccount, walletIndex, chain } = walletAddress
        return (
          <>
            <div className="flex w-full space-x-4">
              <>
                <div className="text-[12px] text-text2 uppercase dark:text-text2d">
                  <div>{intl.formatMessage({ id: 'settings.wallet.account' })}</div>
                </div>
                <div className="text-[12px] text-text2 uppercase dark:text-text2d">{walletAccount}</div>
              </>
              <div className="text-[12px] text-text2 uppercase dark:text-text2d">
                {intl.formatMessage({ id: 'settings.wallet.index' })}
              </div>
              <div className="text-[12px] text-text2 uppercase dark:text-text2d">{walletIndex}</div>
              {/* Show derivation path for all chains */}
              <div className="text-[12px] text-text2 dark:text-text2d">
                {isEvmChain(chain)
                  ? `${getEvmDerivationPath(walletAddress.walletAccount, walletAddress.hdMode as EvmHDMode)}${
                      walletAddress.walletIndex
                    }`
                  : getChainDerivationPath(chain, walletAccount, walletIndex, network, walletAddress.hdMode).path}
              </div>
            </div>
          </>
        )
      }

      return (
        <>
          <div className="flex-row">
            <WalletTypeLabel className="mt-10px ml-40px inline-block">
              {walletTypeToI18n(WalletType.Ledger, intl)}
            </WalletTypeLabel>
            <div className="mt-10px ml-40px inline-block">
              {O.isSome(oAddress) ? renderAccount(oAddress.value) : <span></span>}
            </div>
          </div>
          <div className="my-0 w-full overflow-hidden px-40px">
            {FP.pipe(oAddress, O.fold(renderAddAddress, renderAddress))}
          </div>
        </>
      )
    },
    [
      intl,
      walletAccountMap,
      walletIndexMap,
      ledgerChainToAdd,
      addLedgerAddressRD,
      derivationPathIndex,
      evmHDMode,
      updateEvmHDMode,
      addLedgerAddress,
      network,
      clickAddressLinkHandler,
      verifyLedgerAddressHandler,
      removeLedgerAddress
    ]
  )

  // Unified address renderer — same layout for keystore, vultisig, ledger. Only the label differs.
  const renderWalletAddress = useCallback(
    (chain: Chain, address: string, type: WalletType) => {
      return (
        <>
          <WalletTypeLabel className="ml-10 inline-block">{walletTypeToI18n(type, intl)}</WalletTypeLabel>
          <div className="my-0 w-full overflow-hidden px-40px">
            <div className="flex w-full items-center gap-x-1">
              <AddressEllipsis
                address={address}
                chain={chain}
                network={network}
                enableCopy={true}
                className="max-w-full overflow-hidden font-main text-base text-text1 only:mx-auto dark:text-text1d"
              />
              <QrCodeIcon
                className="cursor-pointer text-turquoise"
                width={20}
                height={20}
                onClick={() => setShowQRModal(O.some({ asset: getChainAsset(chain), address }))}
              />
              <Tooltip
                title={intl.formatMessage({
                  id: 'wallet.ledger.viewAddress'
                })}>
                <ArrowUpRightIcon
                  className="cursor-pointer text-turquoise"
                  width={20}
                  height={20}
                  onClick={() => clickAddressLinkHandler(chain, address)}
                />
              </Tooltip>
            </div>
          </div>
        </>
      )
    },
    [intl, network, clickAddressLinkHandler]
  )

  const renderVerifyAddressModal = useCallback(
    (oAddress: AddressToVerify) =>
      FP.pipe(
        oAddress,
        O.fold(
          () => <></>,
          ({ address, chain, hdMode }) => {
            const onOk = () => {
              resetVerifyLedgerAddressRD()
              setLedgerAddressToVerify(O.none)
            }
            const onCancel = () => {
              resetVerifyLedgerAddressRD()
              setLedgerAddressToVerify(O.none)
              // Pass hdMode so cancelling a Taproot verification removes only the
              // Taproot entry, not the (possibly co-existing) Native SegWit one.
              removeLedgerAddress?.(chain, hdMode)
            }

            return (
              <Modal
                title={intl.formatMessage({ id: 'wallet.ledger.verifyAddress.modal.title' })}
                visible={true}
                onOk={onOk}
                onCancel={onCancel}
                closable={false}
                okText={intl.formatMessage({ id: 'common.confirm' })}
                okButtonProps={{ autoFocus: true }}
                cancelText={intl.formatMessage({ id: 'common.reject' })}>
                <div className="text-center">
                  <FormattedMessage
                    id="wallet.ledger.verifyAddress.modal.description"
                    values={{
                      address: (
                        <span className="block transform-none font-main-bold text-[16px] text-inherit">{address}</span>
                      )
                    }}
                  />
                </div>
              </Modal>
            )
          }
        )
      ),
    [intl, removeLedgerAddress, resetVerifyLedgerAddressRD]
  )

  const [accountFilter, setAccountFilter] = useState(emptyString)
  const [enabledChains, setEnabledChains] = useState<EnabledChain[]>([])

  useEffect(() => {
    const subscription = userChains$.subscribe(setEnabledChains)
    return () => subscription.unsubscribe()
  }, [])

  const toggleChain = useCallback(
    (chain: EnabledChain) => {
      const updatedChains = enabledChains.includes(chain)
        ? enabledChains.filter((c) => c !== chain)
        : [...enabledChains, chain]

      setEnabledChains(updatedChains)
      if (enabledChains.includes(chain)) {
        removeChain(chain)
      } else {
        addChain(chain)
      }
    },
    [enabledChains]
  )

  const filterAccounts = useCallback(({ target }: React.ChangeEvent<HTMLInputElement>) => {
    const value = target.value
    setAccountFilter(value.toLowerCase())
  }, [])

  const oFilteredWalletAccounts = useMemo(
    () =>
      FP.pipe(
        oWalletAccounts,
        O.map((walletAccounts) => {
          return FP.pipe(
            walletAccounts,
            A.filter(({ chain }) =>
              accountFilter
                ? chain.toLowerCase().startsWith(accountFilter) ||
                  chainToString(chain).toLowerCase().startsWith(accountFilter)
                : true
            )
          )
        })
      ),
    [accountFilter, oWalletAccounts]
  )

  // TODO (@Veado) Render `exportKeystoreErrorMsg`
  const [_ /* exportKeystoreErrorMsg */, setExportKeystoreErrorMsg] = useState(emptyString)

  const exportHandler = useCallback(async () => {
    try {
      setExportKeystoreErrorMsg(emptyString)
      if (vultisigExportVault && vultisigActiveVaultId) {
        await vultisigExportVault(vultisigActiveVaultId)
      } else if (exportKeystore) {
        await exportKeystore()
      }
    } catch (error) {
      const errorMsg = isError(error) ? (error?.message ?? error.toString()) : `${error}`
      setExportKeystoreErrorMsg(errorMsg)
    }
  }, [vultisigExportVault, vultisigActiveVaultId, exportKeystore, setExportKeystoreErrorMsg])

  const [trustedAddresses, setTrustedAddresses] = useState<TrustedAddresses>()
  const [newAddress, setNewAddress] = useState<Partial<TrustedAddress>>({})

  useEffect(() => {
    const subscription = userAddresses$.subscribe((addresses) => setTrustedAddresses({ addresses }))
    return () => subscription.unsubscribe()
  }, [])

  const handleAddAddress = useCallback(() => {
    if (newAddress.name && newAddress.address && newAddress.chain) {
      addAddress({ name: newAddress.name, address: newAddress.address, chain: newAddress.chain })
      setNewAddress({})
      // TODO: notification
      // message.success(intl.formatMessage({ id: 'common.addAddress' }))
    } else {
      // message.error(intl.formatMessage({ id: 'common.error' }))
    }
  }, [newAddress])

  const handleRemoveAddress = useCallback((address: TrustedAddress) => {
    removeAddress(address)
    // TODO: notification
    // message.success(intl.formatMessage({ id: 'common.removeAddress' }))
  }, [])

  const renderAddAddressForm = useCallback(
    () => (
      <div className="mb-4 flex items-center gap-3">
        <AutoComplete
          placeholder={intl.formatMessage({ id: 'common.chain' })}
          options={enabledChains.map((chain) => ({ value: chain }))}
          value={newAddress.chain}
          onChange={(value) => setNewAddress((prev) => ({ ...prev, chain: value as Chain }))}
        />
        <Input
          className="h-[38px] border border-solid border-bg2 bg-bg0 dark:border-bg2d dark:bg-bg0d"
          uppercase={false}
          placeholder={intl.formatMessage({ id: 'common.address' })}
          value={newAddress.address}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, address: e.target.value }))}
        />
        <Input
          className="h-[38px] border border-solid border-bg2 bg-bg0 dark:border-bg2d dark:bg-bg0d"
          uppercase={false}
          placeholder={intl.formatMessage({ id: 'wallet.column.name' })}
          value={newAddress.name}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, name: e.target.value }))}
        />

        <div className="mr-30px flex items-center md:mr-0">
          <Button
            typevalue="transparent"
            className="cursor-pointer gap-x-1 pl-0 text-[12px]"
            onClick={handleAddAddress}>
            <PlusCircleIcon className="text-turquoise" width={20} height={20} />
            {intl.formatMessage({ id: 'common.store' })}
          </Button>
          <InfoIcon className="ml-2" tooltip={intl.formatMessage({ id: 'settings.wallet.storeAddress.info' })} />
        </div>
      </div>
    ),
    [newAddress, handleAddAddress, intl, enabledChains]
  )

  const renderTrustedAddresses = useCallback(
    (chain: Chain) => {
      return (trustedAddresses?.addresses.filter((addr) => addr.chain === chain) || []).map((item) => (
        <div key={item.address} className="flex w-full flex-col">
          <Label size="big">{item.name}</Label>
          <div className="flex w-full items-center space-x-2">
            <AddressEllipsis
              className="max-w-full overflow-hidden font-main text-base text-text1 only:mx-auto dark:text-text1d"
              address={item.address}
              chain={chain}
              network={network}
              enableCopy={true}
            />
            <RemoveIcon className="h-4 w-4" onClick={() => handleRemoveAddress(item)} />
          </div>
        </div>
      ))
    },
    [trustedAddresses?.addresses, network, handleRemoveAddress]
  )
  // Unified chain row renderer — shared by keystore and vultisig modes.
  // Each row: ChainIcon + name → address with label → optional ledger → toggle → trusted addresses
  const renderChainRow = useCallback(
    (chain: Chain, address: string, type: WalletType, oLedger?: O.Option<WalletAddress>) => (
      // BTC renders two rows (Native SegWit + Taproot keystore addresses), so the
      // key and the per-row ledger form state must be unique per address, not per chain.
      <div
        key={`${chain}-${type}-${address}`}
        className="flex flex-col border-b border-solid border-b-gray0 p-4 dark:border-b-gray0d">
        <div className="flex w-full items-center justify-start">
          <ChainIcon chain={chain} size="small" />
          <Label className="p-0 pl-[10px] text-xl leading-[25px] tracking-[2px]" textTransform="uppercase">
            {chainToString(chain)}
          </Label>
        </div>
        <div className="mt-10px w-full">
          {renderWalletAddress(chain, address, type)}
          {!isVultisig && oLedger && isEnabledLedger(chain, network) && isSupportedChain(chain)
            ? renderLedgerAddress(chain, oLedger, `${chain}-${type}-${address}`)
            : !isVultisig && renderLedgerNotSupported}
        </div>
        {isSupportedChain(chain) && (
          <div className="mt-10px flex w-full items-center px-40px">
            <SwitchButton
              active={enabledChains.includes(chain as EnabledChain)}
              onChange={() => toggleChain(chain as EnabledChain)}
            />
            <span className="ml-2 text-text0 dark:text-text0d">
              {enabledChains.includes(chain as EnabledChain)
                ? intl.formatMessage({ id: 'common.enable' }, { chain })
                : intl.formatMessage({ id: 'common.disable' }, { chain })}
            </span>
          </div>
        )}
        {/* Trusted Addresses */}
        <div className="mt-10px w-full px-40px">
          {trustedAddresses?.addresses.some((addr) => addr.chain === chain) && (
            <div className="text-text0 dark:text-text0d">
              <h4 className="text-text0 dark:text-text0d">{intl.formatMessage({ id: 'common.savedAddresses' })}</h4>
              {renderTrustedAddresses(chain)}
            </div>
          )}
        </div>
      </div>
    ),
    [
      isVultisig,
      renderWalletAddress,
      network,
      renderLedgerAddress,
      renderLedgerNotSupported,
      enabledChains,
      intl,
      trustedAddresses?.addresses,
      renderTrustedAddresses,
      toggleChain
    ]
  )

  // Unified account list — keystore mode uses walletAccounts, vultisig mode uses vultisigState.addresses
  const renderAccounts = useMemo(() => {
    if (isVultisig) {
      // Vultisig: derive chain rows from SDK addresses
      if (!vultisigState) return <></>
      const entries = Object.entries(vultisigState.addresses)
      if (entries.length === 0) {
        return <div className="py-4 text-center text-text2 dark:text-text2d">No addresses available</div>
      }

      const filteredEntries = entries.filter(([sdkChain]) => {
        const asgardexChain = SDK_TO_ASGARDEX_CHAIN[sdkChain]
        if (!asgardexChain) return !accountFilter
        if (!accountFilter) return true
        return (
          asgardexChain.toLowerCase().startsWith(accountFilter) ||
          sdkChain.toLowerCase().startsWith(accountFilter) ||
          chainToString(asgardexChain).toLowerCase().startsWith(accountFilter)
        )
      })

      return (
        <div className="flex flex-col" key="wallet-accounts">
          {filteredEntries.map(([sdkChain, address]) => {
            const chain = SDK_TO_ASGARDEX_CHAIN[sdkChain]
            if (!chain) return null
            return renderChainRow(chain as Chain, address, WalletType.Vultisig)
          })}
        </div>
      )
    }

    // Keystore: derive chain rows from walletAccounts observable
    return FP.pipe(
      oFilteredWalletAccounts,
      O.map((walletAccounts) => (
        <div className="flex flex-col" key="wallet-accounts">
          {walletAccounts.map(({ chain, accounts: { keystore, ledger: oLedger } }) =>
            renderChainRow(chain, keystore.address, WalletType.Keystore, oLedger)
          )}
        </div>
      )),
      O.getOrElse(() => <></>)
    )
  }, [isVultisig, vultisigState, accountFilter, oFilteredWalletAccounts, renderChainRow])

  const { state: changeWalletState, subscribe: subscribeChangeWalletState } =
    useSubscriptionState<ChangeKeystoreWalletRD>(RD.initial)

  const walletNames = useMemo(
    () =>
      FP.pipe(
        wallets,
        getWalletNamesFromKeystoreWallets,
        A.filter((name) => !eqString.equals(name, walletName))
      ),
    [walletName, wallets]
  )

  const changeWalletHandler = useCallback(
    (id: KeystoreId) => {
      if (changeKeystoreWallet$) {
        subscribeChangeWalletState(changeKeystoreWallet$(id))
      }
    },
    [changeKeystoreWallet$, subscribeChangeWalletState]
  )

  // Vultisig vault change handler
  const changeVaultHandler = useCallback(
    async (vaultId: string) => {
      if (vultisigChangeVault) {
        await vultisigChangeVault(vaultId)
      }
    },
    [vultisigChangeVault]
  )

  const renderChangeWalletError = useMemo(
    () =>
      FP.pipe(
        changeWalletState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => (
            <p className="px-5px font-main text-14 text-error0 uppercase dark:text-error0d">
              {intl.formatMessage({ id: 'wallet.change.error' })} {error.message || error.toString()}
            </p>
          ),

          () => <></>
        )
      ),
    [changeWalletState, intl]
  )

  useEffect(() => {
    if (RD.isSuccess(changeWalletState)) {
      // Jump to `UnlockView` to avoid staying at wallet settings
      navigate(walletRoutes.locked.path())
    }
  }, [changeWalletState, navigate])

  const { state: renameWalletState, subscribe: subscribeRenameWalletState } =
    useSubscriptionState<RenameKeystoreWalletRD>(RD.initial)

  const changeWalletNameHandler = useCallback(
    (newName: string) => {
      if (vultisigRenameVault && vultisigActiveVaultId) {
        // Vultisig: rename vault via SDK
        vultisigRenameVault(vultisigActiveVaultId, newName)
      } else if (renameKeystoreWallet$) {
        // Keystore: rename via observable
        subscribeRenameWalletState(renameKeystoreWallet$(walletId, newName))
      }
    },
    [vultisigRenameVault, vultisigActiveVaultId, renameKeystoreWallet$, subscribeRenameWalletState, walletId]
  )

  const renderRenameWalletError = useMemo(
    () =>
      FP.pipe(
        renameWalletState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => (
            <p className="text-center font-main text-[14px] text-error0 uppercase">
              {intl.formatMessage({ id: 'wallet.name.error.rename' })} {error?.message ?? error.toString()}
            </p>
          ),
          () => <></>
        )
      ),
    [intl, renameWalletState]
  )

  return (
    <div className="bg-bg0 py-6 dark:bg-bg0d">
      {showPasswordModal && (
        <WalletPasswordConfirmationModal
          validatePassword$={validatePassword$}
          onSuccess={onSuccessPassword}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
      {!isVultisig && showPhraseModal && (
        <PhraseCopyModal
          phrase={phrase}
          visible={showPhraseModal}
          onClose={() => {
            setShowPhraseModal(false)
          }}
        />
      )}
      <RemoveWalletConfirmationModal
        visible={showRemoveWalletModal}
        onClose={() => setShowRemoveWalletModal(false)}
        onSuccess={() => removeWalletHandler()}
        walletName={walletName}
        walletType={isVultisig ? WalletType.Vultisig : WalletType.Keystore}
      />
      {renderQRCodeModal}

      {!isVultisig && renderVerifyAddressModal(ledgerAddressToVerify)}
      <div className="w-full px-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className="font-main text-16 text-text0 uppercase dark:text-text0d">
            {intl.formatMessage({ id: 'settings.wallet.management' })}
          </h1>
          <div className="flex flex-row items-center space-x-2">
            <WalletSelector
              className="min-w-[200px]"
              disabled={RD.isPending(changeWalletState)}
              wallets={wallets}
              vultisigVaults={vultisigVaults}
              activeVultisigVaultId={activeVaultId}
              onChange={changeWalletHandler}
              onVultisigSelect={changeVaultHandler}
            />
            <FlatButton size="normal" color="primary" onClick={() => navigate(walletRoutes.noWallet.path())}>
              {intl.formatMessage({ id: 'wallet.add.label' })}
            </FlatButton>
            {/* // TODO: needs to show error on notification */}
            {renderChangeWalletError}
          </div>
        </div>
        <EditableWalletName
          className="mt-4"
          name={walletName}
          names={walletNames}
          onChange={changeWalletNameHandler}
          loading={RD.isPending(renameWalletState)}
        />
        {renderRenameWalletError}
        <div className="mt-10 flex flex-row items-center justify-center space-x-2">
          <ActionButton
            icon={<ArrowUpTrayIcon width={24} height={24} />}
            text={intl.formatMessage({ id: 'settings.export.title' })}
            onClick={exportHandler}
          />
          <ActionButton
            icon={<LockClosedIcon width={24} height={24} />}
            text={intl.formatMessage({ id: 'settings.lock.title' })}
            onClick={lockWallet}
          />
          {!isVultisig && (
            <ActionButton
              icon={<EyeIcon width={24} height={24} />}
              text={intl.formatMessage({ id: 'settings.view.phrase.title' })}
              onClick={() => setShowPasswordModal(true)}
            />
          )}
          <ActionButton
            icon={<TrashIcon width={24} height={24} />}
            text={intl.formatMessage({ id: 'wallet.remove.label' })}
            onClick={() => setShowRemoveWalletModal(true)}
          />
        </div>
      </div>
      <div key="accounts" className="mt-4 w-full border-t border-solid border-bg2 dark:border-bg2d">
        <Label className="pt-5 pl-5 text-center text-base md:text-left" textTransform="uppercase">
          {intl.formatMessage({ id: 'settings.accounts.title' })}
        </Label>
        <div className="mt-30px flex justify-center md:ml-4 md:justify-start">
          <InputSearch
            placeholder={intl.formatMessage({ id: 'common.search' }).toUpperCase()}
            size="large"
            onChange={filterAccounts}
          />
        </div>
        <div className="mt-10px border-b border-solid border-bg2 px-4 dark:border-bg2d">{renderAddAddressForm()}</div>
        <div className="flex items-center justify-center">
          <Label className="pt-5 pl-5 text-center text-base md:text-left" textTransform="uppercase">
            {intl.formatMessage({ id: 'common.chainManagement' })}
          </Label>
          <FlatButton
            size="normal"
            color="primary"
            className="mt-5 mr-5 w-[160px]"
            onClick={() => setIsWhitelistModalOpen(true)}>
            {intl.formatMessage({ id: 'common.importTokens' })}
          </FlatButton>
        </div>
        {renderAccounts}
      </div>
      {isWhitelistModalOpen && (
        <WhitelistModal open={isWhitelistModalOpen} onClose={() => setIsWhitelistModalOpen(false)} />
      )}
    </div>
  )
}
