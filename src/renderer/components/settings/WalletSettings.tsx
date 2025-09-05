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
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, Address, Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { List, message } from 'antd'
import clsx from 'clsx'
import { function as FP, array as A, option as O } from 'fp-ts'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { KeystoreId, TrustedAddress, TrustedAddresses } from '../../../shared/api/types'
import { getDerivationPath as getEvmDerivationPath } from '../../../shared/evm/ledger'
import { EvmHDMode } from '../../../shared/evm/types'
import { chainToString, EnabledChain, isSupportedChain } from '../../../shared/utils/chain'
import { isError } from '../../../shared/utils/guard'
import { UtxoHDMode } from '../../../shared/utxo/types'
import { HDMode, WalletAddress, WalletType } from '../../../shared/wallet/types'
import RemoveIcon from '../../assets/svg/icon-remove.svg?react'
import { WalletPasswordConfirmationModal } from '../../components/modal/confirmation'
import { RemoveWalletConfirmationModal } from '../../components/modal/confirmation/RemoveWalletConfirmationModal'
import { AssetIcon } from '../../components/uielements/assets/assetIcon/AssetIcon'
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
  VerifiedLedgerAddressRD
} from '../../services/wallet/types'
import { walletTypeToI18n } from '../../services/wallet/util'
import { useApp } from '../../store/app/hooks'
import { FlatButton } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { WalletTypeLabel } from '../uielements/common/Common.styles'
import { Dropdown } from '../uielements/dropdown'
import { InfoIcon } from '../uielements/info'
import { Input, InputSearch } from '../uielements/input'
import { Label } from '../uielements/label'
import { Modal } from '../uielements/modal'
import { Tooltip } from '../uielements/tooltip'
import { WalletSelector } from '../uielements/wallet'
import { EditableWalletName } from '../uielements/wallet/EditableWalletName'
import * as Styled from './WalletSettings.styles'
import { WhitelistModal } from './WhitelistModal'

// Bitcoin derivation path templates - will be filled with actual account/index values
const getBitcoinDerivationPaths = (account: number, index: number) => [
  `Native Segwit P2WPKH (m/84'/0'/${account}'/${index})`,
  `Taproot P2TR (m/86'/0'/${account}'/${index})`
]

// Convert derivation path index to UtxoHDMode for Bitcoin
const derivationIndexToHDMode = (index: number): UtxoHDMode => {
  switch (index) {
    case 0:
      return 'p2wpkh'
    case 1:
      return 'p2tr'
    default:
      return 'p2wpkh'
  }
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

type Props = {
  network: Network
  walletAccounts: O.Option<WalletAccounts>
  lockWallet: FP.Lazy<void>
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
  removeLedgerAddress: (chain: Chain) => void
  keystoreUnlocked: KeystoreUnlocked
  wallets: KeystoreWalletsUI
  clickAddressLinkHandler: (chain: Chain, address: Address) => void
  validatePassword$: ValidatePasswordHandler
  evmHDMode: EvmHDMode
  updateEvmHDMode: (mode: EvmHDMode) => void
}

type AddressToVerify = O.Option<{ address: Address; chain: Chain }>

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
  [KUJIChain]: 0,
  [ARBChain]: 0,
  [RadixChain]: 0,
  [SOLChain]: 0,
  [ADAChain]: 0,
  [ZECChain]: 0,
  [XRPChain]: 0
}

export const WalletSettings = (props: Props): JSX.Element => {
  const {
    network,
    walletAccounts: oWalletAccounts,
    lockWallet,
    removeKeystoreWallet,
    changeKeystoreWallet$,
    renameKeystoreWallet$,
    exportKeystore,
    addLedgerAddress$,
    verifyLedgerAddress$,
    removeLedgerAddress,
    keystoreUnlocked: { phrase, name: walletName, id: walletId },
    wallets,
    clickAddressLinkHandler,
    validatePassword$,
    updateEvmHDMode,
    evmHDMode
  } = props
  const { isWhitelistModalOpen, setIsWhitelistModalOpen } = useApp()

  const intl = useIntl()
  const navigate = useNavigate()

  const [showPhraseModal, setShowPhraseModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showRemoveWalletModal, setShowRemoveWalletModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState<O.Option<{ asset: Asset; address: Address }>>(O.none)
  const closeQrModal = useCallback(() => setShowQRModal(O.none), [setShowQRModal])

  const removeWalletHandler = useCallback(async () => {
    const noWallets = await removeKeystoreWallet()
    if (noWallets >= 1) {
      // goto unlock screen to unlock another wallet
      navigate(walletRoutes.locked.path())
    } else {
      // no wallet -> go to homepage
      navigate(appRoutes.base.template)
    }
  }, [removeKeystoreWallet, navigate])

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

  const [walletIndexMap, setWalletIndexMap] = useState<Record<EnabledChain, number>>(initialMap)
  const [derivationPathIndex, setDerivationPathIndex] = useState<Record<EnabledChain, number>>(initialMap)
  const [walletAccountMap, setWalletAccountMap] = useState<Record<EnabledChain, number>>(initialMap)

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
        <Styled.WalletTypeLabel>{walletTypeToI18n(WalletType.Ledger, intl)}</Styled.WalletTypeLabel>
        <div className="ml-40px flex items-center pt-5px text-[12px] uppercase text-text2 dark:text-text2d">
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
    (chain: Chain, walletAccount: number, walletIndex: number) => {
      resetAddLedgerAddressRD()
      setLedgerChainToAdd(O.some(chain))

      let hdMode: HDMode = 'default'
      if (isEvmChain(chain)) {
        hdMode = evmHDMode
      } else if (chain === BTCChain) {
        // Only Bitcoin supports multiple derivation path options
        hdMode = derivationIndexToHDMode(derivationPathIndex[chain])
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
    [resetAddLedgerAddressRD, subscribeAddLedgerAddressRD, addLedgerAddress$, evmHDMode, derivationPathIndex]
  )

  const verifyLedgerAddressHandler = useCallback(
    (walletAddress: WalletAddress) => {
      const { chain, walletAccount, walletIndex, address, hdMode } = walletAddress
      setLedgerAddressToVerify(O.some({ chain, address }))
      subscribeVerifyLedgerAddressRD(
        verifyLedgerAddress$({
          chain,
          walletAccount,
          walletIndex,
          hdMode
        })
      )
    },
    [subscribeVerifyLedgerAddressRD, verifyLedgerAddress$]
  )

  const renderLedgerAddress = useCallback(
    (chain: EnabledChain, oAddress: O.Option<WalletAddress>) => {
      const renderAddAddress = () => {
        const onChangeEvmDerivationMode = (evmMode: EvmHDMode) => {
          updateEvmHDMode(evmMode)
        }
        const selectedAccountIndex = walletAccountMap[chain]
        const selectedWalletIndex = walletIndexMap[chain]

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
            (error) => <p className="pt-10px font-main text-[12px] uppercase text-error0">{error.msg}</p>,
            empty
          )
        )

        const addLedgerAddressHandler = () => {
          addLedgerAddress(chain, selectedAccountIndex, selectedWalletIndex)
        }

        return (
          <>
            <div className="flex w-full flex-col md:w-auto lg:flex-row">
              <div className="mr-30px flex items-center md:mr-0">
                <Styled.AddLedgerButton className="gap-x-1" loading={loading} onClick={addLedgerAddressHandler}>
                  <PlusCircleIcon className="text-turquoise" width={20} height={20} />
                  {intl.formatMessage({ id: 'ledger.add.device' })}
                </Styled.AddLedgerButton>

                <>
                  <div className="text-[12px] uppercase text-text2 dark:text-text2d">
                    {intl.formatMessage({ id: 'settings.wallet.account' })}
                  </div>
                  <Styled.WalletIndexInput
                    value={selectedAccountIndex.toString()}
                    pattern="[0-9]+"
                    onChange={(value) =>
                      value !== null && +value >= 0 && setWalletAccountMap({ ...walletAccountMap, [chain]: +value })
                    }
                    style={{ width: 60 }}
                    disabled={loading || (isEvmChain(chain) && evmHDMode !== 'ledgerlive')}
                    onPressEnter={addLedgerAddressHandler}
                  />
                  <InfoIcon tooltip={intl.formatMessage({ id: 'settings.wallet.account.info' })} />
                </>

                <div className="ml-2 text-[12px] uppercase text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'settings.wallet.index' })}
                </div>
                <Styled.WalletIndexInput
                  className="border border-solid border-bg2 dark:border-bg2d"
                  value={selectedWalletIndex.toString()}
                  pattern="[0-9]+"
                  onChange={(value) =>
                    value !== null && +value >= 0 && setWalletIndexMap({ ...walletIndexMap, [chain]: +value })
                  }
                  style={{ width: 60 }}
                  disabled={loading}
                  onPressEnter={addLedgerAddressHandler}
                />
                <InfoIcon tooltip={intl.formatMessage({ id: 'settings.wallet.index.info' })} />

                {chain === BTCChain && (
                  <div className="ml-2">
                    <Dropdown
                      trigger={
                        <Label className="rounded-lg p-2 border border-solid border-bg2 dark:border-bg2d">
                          {
                            getBitcoinDerivationPaths(selectedAccountIndex, selectedWalletIndex)[
                              derivationPathIndex[chain]
                            ]
                          }
                        </Label>
                      }
                      options={getBitcoinDerivationPaths(selectedAccountIndex, selectedWalletIndex).map(
                        (item: string, index: number) => (
                          <Label
                            key={item}
                            className="px-1"
                            size="normal"
                            onClick={() => setDerivationPathIndex({ ...derivationPathIndex, [chain]: index })}>
                            {item}
                          </Label>
                        )
                      )}
                    />
                  </div>
                )}
              </div>
              {isEvmChain(chain) && (
                <RadioGroup
                  className="flex flex-col items-start lg:flex-row lg:items-center lg:pl-30px lg:space-x-2"
                  onChange={onChangeEvmDerivationMode}
                  value={evmHDMode}>
                  <Radio value="ledgerlive" key="ledgerlive">
                    <Label className="flex items-center mt-10px lg:mt-0" textTransform="uppercase">
                      {intl.formatMessage({ id: 'common.ledgerlive' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'settings.wallet.hdpath.ledgerlive.info' },
                          {
                            path: `${getEvmDerivationPath(walletAccountMap[chain], 'ledgerlive')}{index}`
                          }
                        )}
                      />
                    </Label>
                  </Radio>
                  <Radio value="legacy" key="legacy">
                    <Label className="flex items-center mt-10px lg:mt-0" textTransform="uppercase">
                      {intl.formatMessage({ id: 'common.legacy' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'settings.wallet.hdpath.legacy.info' },
                          { path: `${getEvmDerivationPath(walletAccountMap[chain], 'legacy')}{index}` }
                        )}
                      />
                    </Label>
                  </Radio>
                  <Radio value="metamask" key="metamask">
                    <Label className="flex items-center mt-10px lg:mt-0" textTransform="uppercase">
                      {intl.formatMessage({ id: 'common.metamask' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'settings.wallet.hdpath.metamask.info' },
                          { path: `${getEvmDerivationPath(walletAccountMap[chain], 'metamask')}{index}` }
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
              <Styled.AddressEllipsis address={address} chain={chain} network={network} enableCopy={true} />
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
                  className="text-turquoise cursor-pointer"
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
                <RemoveIcon className="w-4 h-4" onClick={() => removeLedgerAddress(chain)} />
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
                <div className="text-[12px] uppercase text-text2 dark:text-text2d">
                  <div>{intl.formatMessage({ id: 'settings.wallet.account' })}</div>
                </div>
                <div className="text-[12px] uppercase text-text2 dark:text-text2d">{walletAccount}</div>
              </>
              <div className="text-[12px] uppercase text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'settings.wallet.index' })}
              </div>
              <div className="text-[12px] uppercase text-text2 dark:text-text2d">{walletIndex}</div>
              {isEvmChain(chain) && (
                <div className="text-[12px] uppercase text-text2 dark:text-text2d">{`${getEvmDerivationPath(
                  walletAccountMap[chain],
                  `${evmHDMode}`
                )}${walletIndex}`}</div>
              )}
            </div>
          </>
        )
      }

      return (
        <>
          <div className="flex-row">
            <WalletTypeLabel className="ml-40px mt-10px inline-block ">
              {walletTypeToI18n(WalletType.Ledger, intl)}
            </WalletTypeLabel>
            <div className="ml-40px mt-10px inline-block ">
              {O.isSome(oAddress) ? renderAccount(oAddress.value) : <span></span>}
            </div>
          </div>
          <div className="my-0 w-full overflow-hidden px-40px ">
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

  const renderKeystoreAddress = useCallback(
    (chain: Chain, { address }: WalletAddress) => {
      // Render addresses depending on its loading state
      return (
        <>
          <Styled.WalletTypeLabel>{walletTypeToI18n(WalletType.Keystore, intl)}</Styled.WalletTypeLabel>
          <div className="my-0 w-full overflow-hidden px-40px ">
            <div className="flex w-full items-center gap-x-1">
              <Styled.AddressEllipsis address={address} chain={chain} network={network} enableCopy={true} />
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
          ({ address, chain }) => {
            const onOk = () => {
              resetVerifyLedgerAddressRD()
              setLedgerAddressToVerify(O.none)
            }
            const onCancel = () => {
              resetVerifyLedgerAddressRD()
              setLedgerAddressToVerify(O.none)
              removeLedgerAddress(chain)
            }

            return (
              <Modal
                title={intl.formatMessage({ id: 'wallet.ledger.verifyAddress.modal.title' })}
                visible={true}
                onOk={onOk}
                onCancel={onCancel}
                maskClosable={false}
                closable={false}
                okText={intl.formatMessage({ id: 'common.confirm' })}
                okButtonProps={{ autoFocus: true }}
                cancelText={intl.formatMessage({ id: 'common.reject' })}>
                <div className="text-center">
                  <FormattedMessage
                    id="wallet.ledger.verifyAddress.modal.description"
                    values={{
                      address: (
                        <span className="block transform-none font-mainBold text-[16px] text-inherit">{address}</span>
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

  const exportKeystoreHandler = useCallback(async () => {
    try {
      setExportKeystoreErrorMsg(emptyString)
      await exportKeystore()
    } catch (error) {
      const errorMsg = isError(error) ? error?.message ?? error.toString() : `${error}`
      setExportKeystoreErrorMsg(errorMsg)
    }
  }, [exportKeystore, setExportKeystoreErrorMsg])

  const [trustedAddresses, setTrustedAddresses] = useState<TrustedAddresses>()
  const [newAddress, setNewAddress] = useState<Partial<TrustedAddress>>({})

  useEffect(() => {
    const subscription = userAddresses$.subscribe((addresses) => setTrustedAddresses({ addresses }))
    return () => subscription.unsubscribe()
  }, [])

  const handleAddAddress = useCallback(() => {
    if (newAddress.name && newAddress.address && newAddress.chain) {
      addAddress({ name: newAddress.name, address: newAddress.address, chain: newAddress.chain })
      setNewAddress({ chain: '', name: '', address: '' })
      message.success(intl.formatMessage({ id: 'common.addAddress' }))
    } else {
      message.error(intl.formatMessage({ id: 'common.error' }))
    }
  }, [newAddress, intl])

  const handleRemoveAddress = useCallback(
    (address: TrustedAddress) => {
      removeAddress(address)
      message.success(intl.formatMessage({ id: 'common.removeAddress' }))
    },
    [intl]
  )

  const renderAddAddressForm = useCallback(
    () => (
      <div className="flex items-center gap-3 mb-4">
        <Styled.AutoComplete
          className="w-40 mr-2"
          key={newAddress.chain || 'autocomplete'}
          placeholder={intl.formatMessage({ id: 'common.chain' })}
          options={enabledChains.map((chain) => ({ value: chain }))}
          value={newAddress.chain}
          onChange={(value) => setNewAddress((prev) => ({ ...prev, chain: value as string }))}
          filterOption={(inputValue, option) =>
            option ? option.value.toLowerCase().includes(inputValue.toLowerCase()) : false
          }
        />
        <Input
          className="border border-solid border-bg2 bg-bg0 dark:border-bg2d dark:bg-bg0d"
          uppercase={false}
          placeholder={intl.formatMessage({ id: 'common.address' })}
          value={newAddress.address}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, address: e.target.value }))}
        />
        <Input
          className="border border-solid border-bg2 bg-bg0 dark:border-bg2d dark:bg-bg0d"
          uppercase={false}
          placeholder={intl.formatMessage({ id: 'wallet.column.name' })}
          value={newAddress.name}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, name: e.target.value }))}
        />

        <div className="mr-30px flex items-center md:mr-0">
          <Styled.AddLedgerButton className="gap-x-1" onClick={handleAddAddress}>
            <PlusCircleIcon className="text-turquoise" width={20} height={20} />
            {intl.formatMessage({ id: 'common.store' })}
          </Styled.AddLedgerButton>
          <InfoIcon className="ml-10px" tooltip={intl.formatMessage({ id: 'settings.wallet.storeAddress.info' })} />
        </div>
      </div>
    ),
    [newAddress, handleAddAddress, intl, enabledChains]
  )

  const renderTrustedAddresses = useCallback(
    (chain: Chain) => (
      <List
        dataSource={trustedAddresses?.addresses.filter((addr) => addr.chain === chain) || []}
        renderItem={(item) => (
          <List.Item>
            <div className="flex w-full items-center justify-between">
              <List.Item.Meta
                title={<div className="text-text0 dark:text-text0d">{item.name}</div>}
                description={
                  <div className="flex w-full items-center ">
                    {' '}
                    <Styled.AddressEllipsis address={item.address} chain={chain} network={network} enableCopy={true} />
                    <RemoveIcon className="w-4 h-4" onClick={() => handleRemoveAddress(item)} />
                  </div>
                }
              />
            </div>
          </List.Item>
        )}
      />
    ),
    [trustedAddresses?.addresses, network, handleRemoveAddress]
  )
  const renderAccounts = useMemo(
    () =>
      FP.pipe(
        oFilteredWalletAccounts,
        O.map((walletAccounts) => (
          <List
            key="accounts"
            dataSource={walletAccounts}
            renderItem={({ chain, accounts: { keystore, ledger: oLedger } }, i: number) => (
              <Styled.ListItem key={i}>
                <div className="flex w-full items-center justify-start">
                  <AssetIcon asset={getChainAsset(chain)} size="small" network={Network.Mainnet} />
                  <Styled.AccountTitle>{chain}</Styled.AccountTitle>
                </div>
                <div className="mt-10px w-full">
                  {/* Render keystore and ledger addresses as before */}
                  {renderKeystoreAddress(chain, keystore)}
                  {isEnabledLedger(chain, network) && isSupportedChain(chain)
                    ? renderLedgerAddress(chain, oLedger)
                    : renderLedgerNotSupported}
                </div>
                <div className="mt-10px flex w-full items-center px-40px">
                  <SwitchButton active={enabledChains.includes(chain)} onChange={() => toggleChain(chain)} />
                  <span className="ml-2 text-text0 dark:text-text0d">
                    {enabledChains.includes(chain)
                      ? intl.formatMessage({ id: 'common.enable' }, { chain })
                      : intl.formatMessage({ id: 'common.disable' }, { chain })}
                  </span>
                </div>

                {/* Render Trusted Addresses */}
                <div className="mt-10px w-full px-40px">
                  {/* {renderAddAddressForm(chain)} */}
                  {trustedAddresses?.addresses.some((addr) => addr.chain === chain) && (
                    <div className="text-text0 dark:text-text0d">
                      <h4 className="text-text0 dark:text-text0d">
                        {intl.formatMessage({ id: 'common.savedAddresses' })}
                      </h4>
                      {renderTrustedAddresses(chain)}
                    </div>
                  )}
                </div>
              </Styled.ListItem>
            )}
          />
        )),
        O.getOrElse(() => <></>)
      ),
    [
      oFilteredWalletAccounts,
      renderKeystoreAddress,
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
      subscribeChangeWalletState(changeKeystoreWallet$(id))
    },
    [changeKeystoreWallet$, subscribeChangeWalletState]
  )

  const renderChangeWalletError = useMemo(
    () =>
      FP.pipe(
        changeWalletState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => (
            <p className="px-5px font-main text-14 uppercase text-error0 dark:text-error0d">
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
    (walletName: string) => {
      subscribeRenameWalletState(renameKeystoreWallet$(walletId, walletName))
    },
    [renameKeystoreWallet$, subscribeRenameWalletState, walletId]
  )

  const renderRenameWalletError = useMemo(
    () =>
      FP.pipe(
        renameWalletState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => (
            <p className="text-center font-main text-[14px] uppercase text-error0">
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
      {showPhraseModal && (
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
      />
      {renderQRCodeModal}

      {renderVerifyAddressModal(ledgerAddressToVerify)}
      <div className="w-full px-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className="font-main text-16 uppercase text-text0 dark:text-text0d">
            {intl.formatMessage({ id: 'settings.wallet.management' })}
          </h1>
          <div className="flex flex-row items-center space-x-2">
            <WalletSelector
              className="min-w-[200px]"
              disabled={RD.isPending(changeWalletState)}
              wallets={wallets}
              onChange={changeWalletHandler}
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
            onClick={exportKeystoreHandler}
          />
          <ActionButton
            icon={<LockClosedIcon width={24} height={24} />}
            text={intl.formatMessage({ id: 'settings.lock.title' })}
            onClick={lockWallet}
          />
          <ActionButton
            icon={<EyeIcon width={24} height={24} />}
            text={intl.formatMessage({ id: 'settings.view.phrase.title' })}
            onClick={() => setShowPasswordModal(true)}
          />
          <ActionButton
            icon={<TrashIcon width={24} height={24} />}
            text={intl.formatMessage({ id: 'wallet.remove.label' })}
            onClick={() => setShowRemoveWalletModal(true)}
          />
        </div>
      </div>
      <div key="accounts" className="mt-4 w-full border-t border-solid border-bg2 dark:border-bg2d">
        <Styled.Subtitle>{intl.formatMessage({ id: 'settings.accounts.title' })}</Styled.Subtitle>
        <div className="mt-30px flex justify-center md:ml-4 md:justify-start">
          <InputSearch
            placeholder={intl.formatMessage({ id: 'common.search' }).toUpperCase()}
            size="large"
            onChange={filterAccounts}
          />
        </div>
        <div className="mt-10px border-b border-solid border-bg2 px-4 dark:border-bg2d">{renderAddAddressForm()}</div>
        <div className="flex items-center justify-center">
          <Styled.Subtitle>{intl.formatMessage({ id: 'common.chainManagement' })}</Styled.Subtitle>
          <ActionButton
            className="mt-5 mr-5"
            text={intl.formatMessage({ id: 'common.whitelist' })}
            onClick={() => setIsWhitelistModalOpen(true)}
          />
        </div>
        {renderAccounts}
      </div>
      {isWhitelistModalOpen && (
        <WhitelistModal open={isWhitelistModalOpen} onClose={() => setIsWhitelistModalOpen(false)} />
      )}
    </div>
  )
}
