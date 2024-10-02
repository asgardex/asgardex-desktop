import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { DeleteOutlined, ExportOutlined, EyeOutlined, LockOutlined, SearchOutlined } from '@ant-design/icons'
import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, Address, Chain, TokenAsset } from '@xchainjs/xchain-util'
import { List, RadioChangeEvent, AutoComplete, message } from 'antd'
import clsx from 'clsx'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { KeystoreId, TrustedAddress, TrustedAddresses } from '../../../shared/api/types'
import { getDerivationPath as getEvmDerivationPath } from '../../../shared/evm/ledger'
import { EvmHDMode } from '../../../shared/evm/types'
import { chainToString, EnabledChain, isSupportedChain } from '../../../shared/utils/chain'
import { isError } from '../../../shared/utils/guard'
import { HDMode, WalletAddress } from '../../../shared/wallet/types'
import { WalletPasswordConfirmationModal } from '../../components/modal/confirmation'
import { RemoveWalletConfirmationModal } from '../../components/modal/confirmation/RemoveWalletConfirmationModal'
import { AssetIcon } from '../../components/uielements/assets/assetIcon/AssetIcon'
import { QRCodeModal } from '../../components/uielements/qrCodeModal/QRCodeModal'
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
import { addAsset, removeAsset } from '../../services/storage/userChainTokens'
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
import { ARB_TOKEN_WHITELIST } from '../../types/generated/mayachain/arberc20whitelist'
import { AVAX_TOKEN_WHITELIST } from '../../types/generated/thorchain/avaxerc20whitelist'
import { BSC_TOKEN_WHITELIST } from '../../types/generated/thorchain/bscerc20whitelist'
import { ERC20_WHITELIST } from '../../types/generated/thorchain/erc20whitelist'
import { AttentionIcon } from '../icons'
import * as StyledR from '../shared/form/Radio.styles'
import { FlatButton } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { Tooltip, WalletTypeLabel } from '../uielements/common/Common.styles'
import { InfoIcon } from '../uielements/info'
import { Modal } from '../uielements/modal'
import { WalletSelector } from '../uielements/wallet'
import { EditableWalletName } from '../uielements/wallet/EditableWalletName'
import * as Styled from './WalletSettings.styles'

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
        'rounded-lg border border-solid border-bg2 dark:border-bg2d',
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

export const WalletSettings: React.FC<Props> = (props): JSX.Element => {
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

  const [walletIndexMap, setWalletIndexMap] = useState<Record<EnabledChain, number>>({
    [BTCChain]: 0,
    [BCHChain]: 0,
    [LTCChain]: 0,
    [THORChain]: 0,
    [ETHChain]: 0,
    [GAIAChain]: 0,
    [DOGEChain]: 0,
    [AVAXChain]: 0,
    [BSCChain]: 0,
    [MAYAChain]: 0,
    [DASHChain]: 0,
    [KUJIChain]: 0,
    [ARBChain]: 0,
    [RadixChain]: 0
  })
  const [walletAccountMap, setWalletAccountMap] = useState<Record<EnabledChain, number>>({
    [BTCChain]: 0,
    [BCHChain]: 0,
    [LTCChain]: 0,
    [THORChain]: 0,
    [ETHChain]: 0,
    [GAIAChain]: 0,
    [DOGEChain]: 0,
    [AVAXChain]: 0,
    [BSCChain]: 0,
    [MAYAChain]: 0,
    [DASHChain]: 0,
    [KUJIChain]: 0,
    [ARBChain]: 0,
    [RadixChain]: 0
  })

  const {
    state: verifyLedgerAddressRD,
    reset: resetVerifyLedgerAddressRD,
    subscribe: subscribeVerifyLedgerAddressRD
  } = useSubscriptionState<VerifiedLedgerAddressRD>(RD.initial)

  useEffect(() => {
    FP.pipe(
      verifyLedgerAddressRD,
      RD.map(() => {
        setLedgerAddressToVerify(O.none) // close modal
        resetVerifyLedgerAddressRD() // reset state
        return true
      })
    )
  }, [verifyLedgerAddressRD, resetVerifyLedgerAddressRD])

  const [ledgerAddressToVerify, setLedgerAddressToVerify] = useState<AddressToVerify>(O.none)

  const renderLedgerNotSupported = useMemo(
    () => (
      <div className="mt-10px w-full">
        <Styled.WalletTypeLabel>{walletTypeToI18n('ledger', intl)}</Styled.WalletTypeLabel>
        <div className="ml-40px flex items-center pt-5px text-[12px] uppercase text-text2 dark:text-text2d">
          <Styled.Icon component={AttentionIcon} />
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
      subscribeAddLedgerAddressRD(
        addLedgerAddress$({
          chain,
          walletAccount,
          walletIndex,
          hdMode: isEvmChain(chain) ? evmHDMode : 'default' // other Ledgers uses `default` path
        })
      )
    },
    [resetAddLedgerAddressRD, subscribeAddLedgerAddressRD, addLedgerAddress$, evmHDMode]
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
        const onChangeEvmDerivationMode = (e: RadioChangeEvent) => {
          updateEvmHDMode(e.target.value as EvmHDMode)
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
                <Styled.AddLedgerButton onClick={addLedgerAddressHandler} loading={loading}>
                  <Styled.AddLedgerIcon /> {intl.formatMessage({ id: 'ledger.add.device' })}
                </Styled.AddLedgerButton>
                <>
                  <div className="text-[12px] uppercase text-text2 dark:text-text2d">
                    {intl.formatMessage({ id: 'setting.wallet.account' })}
                  </div>
                  <Styled.WalletIndexInput
                    value={selectedAccountIndex.toString()}
                    pattern="[0-9]+"
                    onChange={(value) =>
                      value !== null && +value >= 0 && setWalletAccountMap({ ...walletAccountMap, [chain]: +value })
                    }
                    style={{ width: 60 }}
                    disabled={loading}
                    onPressEnter={addLedgerAddressHandler}
                  />
                  <InfoIcon tooltip={intl.formatMessage({ id: 'setting.wallet.account.info' })} />
                </>
                <>
                  <div className="text-[12px] uppercase text-text2 dark:text-text2d">
                    {intl.formatMessage({ id: 'setting.wallet.index' })}
                  </div>
                  <Styled.WalletIndexInput
                    value={selectedWalletIndex.toString()}
                    pattern="[0-9]+"
                    onChange={(value) =>
                      value !== null && +value >= 0 && setWalletIndexMap({ ...walletIndexMap, [chain]: +value })
                    }
                    style={{ width: 60 }}
                    disabled={loading}
                    onPressEnter={addLedgerAddressHandler}
                  />
                  <InfoIcon tooltip={intl.formatMessage({ id: 'setting.wallet.index.info' })} />
                </>
              </div>
              {isEvmChain(chain) && (
                <StyledR.Radio.Group
                  className="!flex flex-col items-start lg:flex-row lg:items-center lg:!pl-30px"
                  onChange={onChangeEvmDerivationMode}
                  value={evmHDMode}>
                  <StyledR.Radio value="ledgerlive" key="ledgerlive">
                    <Styled.EthDerivationModeRadioLabel>
                      {intl.formatMessage({ id: 'common.ledgerlive' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'setting.wallet.hdpath.ledgerlive.info' },
                          {
                            path: getEvmDerivationPath(walletAccountMap[chain], 'ledgerlive')
                          }
                        )}
                      />
                    </Styled.EthDerivationModeRadioLabel>
                  </StyledR.Radio>
                  <StyledR.Radio value="legacy" key="legacy">
                    <Styled.EthDerivationModeRadioLabel>
                      {intl.formatMessage({ id: 'common.legacy' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'setting.wallet.hdpath.legacy.info' },
                          { path: getEvmDerivationPath(walletAccountMap[chain], 'legacy') }
                        )}
                      />
                    </Styled.EthDerivationModeRadioLabel>
                  </StyledR.Radio>
                  <StyledR.Radio value="metamask" key="metamask">
                    <Styled.EthDerivationModeRadioLabel>
                      {intl.formatMessage({ id: 'common.metamask' })}
                      <InfoIcon
                        tooltip={intl.formatMessage(
                          { id: 'setting.wallet.hdpath.metamask.info' },
                          { path: getEvmDerivationPath(walletAccountMap[chain], 'metamask') }
                        )}
                      />
                    </Styled.EthDerivationModeRadioLabel>
                  </StyledR.Radio>
                </StyledR.Radio.Group>
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
            <div className="flex w-full items-center">
              <Styled.AddressEllipsis address={address} chain={chain} network={network} enableCopy={true} />
              <Styled.QRCodeIcon onClick={() => setShowQRModal(O.some({ asset: getChainAsset(chain), address }))} />
              <Tooltip
                title={intl.formatMessage({
                  id: 'wallet.ledger.viewAddress'
                })}>
                <Styled.AddressLinkIcon onClick={() => clickAddressLinkHandler(chain, address)} />
              </Tooltip>
              <Tooltip
                title={intl.formatMessage(
                  {
                    id: 'wallet.ledger.verifyAddress.modal.description'
                  },
                  { address }
                )}>
                <Styled.EyeOutlined onClick={() => verifyLedgerAddressHandler(walletAddress)} />
              </Tooltip>
              <Tooltip
                title={intl.formatMessage(
                  {
                    id: 'wallet.ledger.removeAddress'
                  },
                  { chain }
                )}>
                <Styled.RemoveAddressIcon onClick={() => removeLedgerAddress(chain)} />
              </Tooltip>
            </div>
          </>
        )
      }
      const renderAccount = (walletAddress: WalletAddress) => {
        const { walletAccount, walletIndex } = walletAddress
        return (
          <>
            <div className="flex w-full space-x-4">
              <div className="text-[12px] uppercase text-text2 dark:text-text2d">
                <div>{intl.formatMessage({ id: 'setting.wallet.account' })}</div>
              </div>
              <div className="text-[12px] uppercase text-text2 dark:text-text2d">{walletAccount}</div>
              <div className="text-[12px] uppercase text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'setting.wallet.index' })}
              </div>
              <div className="text-[12px] uppercase text-text2 dark:text-text2d">{walletIndex}</div>
            </div>
          </>
        )
      }

      return (
        <>
          <div className="flex-row">
            <WalletTypeLabel className="ml-40px mt-10px inline-block ">
              {walletTypeToI18n('ledger', intl)}
            </WalletTypeLabel>
            <div className="ml-40px mt-10px inline-block ">
              {O.isSome(oAddress) ? renderAccount(oAddress.value) : <span></span>}
            </div>
          </div>
          <div className="mx-40px my-0 w-full overflow-hidden ">
            {FP.pipe(oAddress, O.fold(renderAddAddress, renderAddress))}
          </div>
        </>
      )
    },
    [
      intl,
      walletIndexMap,
      walletAccountMap,
      ledgerChainToAdd,
      addLedgerAddressRD,
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
          <Styled.WalletTypeLabel>{walletTypeToI18n('keystore', intl)}</Styled.WalletTypeLabel>
          <div className="mx-40px my-0 w-full overflow-hidden ">
            <div className="flex w-full items-center">
              <Styled.AddressEllipsis address={address} chain={chain} network={network} enableCopy={true} />
              <Styled.QRCodeIcon onClick={() => setShowQRModal(O.some({ asset: getChainAsset(chain), address }))} />
              <Tooltip
                title={intl.formatMessage({
                  id: 'wallet.ledger.viewAddress'
                })}>
                <Styled.AddressLinkIcon onClick={() => clickAddressLinkHandler(chain, address)} />
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
        O.map((walletAccounts) =>
          FP.pipe(
            walletAccounts,
            A.filter(({ chain }) =>
              accountFilter
                ? chain.toLowerCase().startsWith(accountFilter) ||
                  chainToString(chain).toLowerCase().startsWith(accountFilter)
                : true
            )
          )
        )
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

  // Handler to update the search state
  const [assetSearch, setAssetSearch] = useState<{ [key in Chain]?: string }>({})
  const [filteredAssets, setFilteredAssets] = useState<{ [key in Chain]?: TokenAsset[] }>({})

  const [isAddingByChain, setIsAddingByChain] = useState<{ [key in Chain]?: boolean }>({
    [ETHChain]: true,
    [AVAXChain]: true,
    [BSCChain]: true,
    [ARBChain]: true
  })

  const toggleStorageMode = useCallback((chain: Chain) => {
    setIsAddingByChain((prevState) => ({
      ...prevState,
      [chain]: !prevState[chain] // Toggle the current state for the specific chain
    }))
  }, [])

  const handleAssetSearch = useCallback((value: string, chain: Chain) => {
    const searchValue = value.toUpperCase()

    setAssetSearch((prevState) => ({
      ...prevState,
      [chain]: searchValue
    }))

    let matchedAssets: TokenAsset[]
    switch (chain) {
      case ETHChain:
        matchedAssets = ERC20_WHITELIST.filter(({ asset }) => asset.symbol.toUpperCase().includes(searchValue)).map(
          ({ asset }) => asset
        )
        break
      case AVAXChain:
        matchedAssets = AVAX_TOKEN_WHITELIST.filter(({ asset }) =>
          asset.symbol.toUpperCase().includes(searchValue)
        ).map(({ asset }) => asset)
        break
      case BSCChain:
        matchedAssets = BSC_TOKEN_WHITELIST.filter(({ asset }) => asset.symbol.toUpperCase().includes(searchValue)).map(
          ({ asset }) => asset
        )
        break
      case ARBChain:
        matchedAssets = ARB_TOKEN_WHITELIST.filter(({ asset }) => asset.symbol.toUpperCase().includes(searchValue)).map(
          ({ asset }) => asset
        )
        break
      default:
        matchedAssets = []
        break
    }
    setFilteredAssets((prevState) => ({
      ...prevState,
      [chain]: matchedAssets
    }))
  }, [])

  const addAssetToStorage = useCallback((asset: TokenAsset, chain: Chain) => {
    addAsset(asset)

    setAssetSearch((prevState) => ({
      ...prevState,
      [chain]: ''
    }))

    setFilteredAssets((prevState) => ({
      ...prevState,
      [chain]: []
    }))
  }, [])

  const handleRemoveAsset = useCallback(
    (value: string, chain: Chain) => {
      const selectedAsset = (filteredAssets[chain] || []).find((asset) => asset.symbol === value)
      if (selectedAsset) {
        removeAsset(selectedAsset)
        setAssetSearch((prevState) => ({
          ...prevState,
          [chain]: ''
        }))

        setFilteredAssets((prevState) => ({
          ...prevState,
          [chain]: []
        }))
      }
    },
    [filteredAssets]
  )

  const onSelectAsset = useCallback(
    (value: string, chain: Chain) => {
      const selectedAsset = (filteredAssets[chain] || []).find((asset) => asset.symbol === value)
      if (selectedAsset) {
        if (isAddingByChain[chain]) {
          addAssetToStorage(selectedAsset, chain)
          message.success(`${selectedAsset.symbol} added to ${selectedAsset.chain} successfully!`)
        } else {
          handleRemoveAsset(selectedAsset.symbol, chain)
          message.success(`${selectedAsset.symbol} removed from ${selectedAsset.chain} successfully!`)
        }
      }
    },
    [addAssetToStorage, filteredAssets, handleRemoveAsset, isAddingByChain]
  )

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
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Styled.AutoComplete
          key={newAddress.chain || 'autocomplete'}
          style={{ width: 150, marginRight: 8 }}
          placeholder={intl.formatMessage({ id: 'common.chain' })}
          options={enabledChains.map((chain) => ({ value: chain }))}
          value={newAddress.chain}
          onChange={(value) => setNewAddress((prev) => ({ ...prev, chain: value as string }))}
          filterOption={(inputValue, option) =>
            option ? option.value.toLowerCase().includes(inputValue.toLowerCase()) : false
          }
        />
        <Styled.Input
          className="rounded-lg border border-solid border-bg2 bg-bg0 dark:border-bg2d dark:bg-bg0d"
          placeholder={intl.formatMessage({ id: 'common.address' })}
          value={newAddress.address}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, address: e.target.value }))}
        />
        <Styled.Input
          className="rounded-lg border border-solid border-bg2 bg-bg0 dark:border-bg2d dark:bg-bg0d"
          placeholder={intl.formatMessage({ id: 'wallet.column.name' })}
          value={newAddress.name}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, name: e.target.value }))}
        />

        <div className="mr-30px flex items-center md:mr-0">
          <Styled.AddLedgerButton onClick={handleAddAddress}>
            <Styled.AddLedgerIcon /> {intl.formatMessage({ id: 'common.store' })}
          </Styled.AddLedgerButton>
          <InfoIcon className="ml-10px" tooltip={intl.formatMessage({ id: 'setting.wallet.storeAddress.info' })} />
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
                    <Styled.RemoveAddressIcon onClick={() => handleRemoveAddress(item)} />
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
                <div className="mx-40px mt-10px flex w-full items-center">
                  <SwitchButton active={enabledChains.includes(chain)} onChange={() => toggleChain(chain)} />
                  <span className="ml-2 text-text0 dark:text-text0d">
                    {enabledChains.includes(chain)
                      ? intl.formatMessage({ id: 'common.enable' }, { chain: chain })
                      : intl.formatMessage({ id: 'common.disable' }, { chain: chain })}
                  </span>
                </div>

                {/* Render Trusted Addresses */}
                <div className="mx-40px mt-10px w-full">
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

                {/* Asset Management Section */}
                {(chain === ETHChain || chain === AVAXChain || chain === BSCChain || chain === ARBChain) && (
                  <div className="mx-40px mt-10px flex w-full items-center">
                    <SwitchButton
                      active={!!isAddingByChain[chain]}
                      onChange={() => toggleStorageMode(chain)}
                      className="mr-10px"
                    />
                    <span className="mr-2 text-text0 dark:text-text0d">
                      {isAddingByChain[chain]
                        ? intl.formatMessage({ id: 'common.add' })
                        : intl.formatMessage({ id: 'common.remove' })}
                    </span>
                    <AutoComplete
                      value={assetSearch[chain] || ''}
                      onChange={(value) => handleAssetSearch(value, chain)}
                      onSelect={(value: string) => onSelectAsset(value, chain)}
                      style={{ minWidth: 450, width: 'auto' }}
                      placeholder={intl.formatMessage({ id: 'common.searchAsset' })}
                      allowClear>
                      {(filteredAssets[chain] || []).map((asset: TokenAsset) => (
                        <AutoComplete.Option key={asset.symbol} value={asset.symbol}>
                          <div>{asset.symbol}</div>
                        </AutoComplete.Option>
                      ))}
                    </AutoComplete>
                    <InfoIcon
                      className="ml-10px"
                      tooltip={
                        isAddingByChain[chain]
                          ? intl.formatMessage({ id: 'common.addAsset' })
                          : intl.formatMessage({ id: 'common.removeAsset' })
                      }
                    />
                  </div>
                )}
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
      isAddingByChain,
      assetSearch,
      filteredAssets,
      toggleChain,
      toggleStorageMode,
      handleAssetSearch,
      onSelectAsset
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
          <h1 className="font-main text-18 uppercase text-text0 dark:text-text0d">
            {intl.formatMessage({ id: 'setting.wallet.management' })}
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
            icon={<ExportOutlined className="text-[24px]" />}
            text={intl.formatMessage({ id: 'setting.export' })}
            onClick={exportKeystoreHandler}
          />
          <ActionButton
            icon={<LockOutlined className="text-[24px]" />}
            text={intl.formatMessage({ id: 'setting.lock' })}
            onClick={lockWallet}
          />
          <ActionButton
            icon={<EyeOutlined className="text-[24px]" />}
            text={intl.formatMessage({ id: 'setting.view.phrase' })}
            onClick={() => setShowPasswordModal(true)}
          />
          <ActionButton
            icon={<DeleteOutlined className="text-[24px]" />}
            text={intl.formatMessage({ id: 'wallet.remove.label' })}
            onClick={() => setShowRemoveWalletModal(true)}
          />
        </div>
      </div>
      <div key="accounts" className="mt-4 w-full border-t border-solid border-bg2 dark:border-bg2d">
        <Styled.Subtitle>{intl.formatMessage({ id: 'setting.accounts' })}</Styled.Subtitle>
        <div className="mt-30px flex justify-center md:ml-4 md:justify-start">
          <Styled.Input
            className="rounded-lg border border-solid border-bg2 bg-bg0 dark:border-bg2d dark:bg-bg0d"
            prefix={<SearchOutlined />}
            onChange={filterAccounts}
            allowClear
            placeholder={intl.formatMessage({ id: 'common.search' }).toUpperCase()}
            size="large"
          />
        </div>
        <div className="mt-10px border-b border-solid border-bg2 px-4 dark:border-bg2d">{renderAddAddressForm()}</div>
        {renderAccounts}
      </div>
    </div>
  )
}
