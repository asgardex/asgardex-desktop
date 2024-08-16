import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { SearchOutlined } from '@ant-design/icons'
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
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, Address, Chain } from '@xchainjs/xchain-util'
import { List, Collapse, RadioChangeEvent, AutoComplete, message } from 'antd'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { KeystoreId } from '../../../shared/api/types'
import { getDerivationPath as getEvmDerivationPath } from '../../../shared/evm/ledger'
import { EvmHDMode } from '../../../shared/evm/types'
import { chainToString, EnabledChain, isSupportedChain } from '../../../shared/utils/chain'
import { isError } from '../../../shared/utils/guard'
import { HDMode, WalletAddress } from '../../../shared/wallet/types'
import { ReactComponent as UnlockOutlined } from '../../assets/svg/icon-unlock-warning.svg'
import { WalletPasswordConfirmationModal } from '../../components/modal/confirmation'
import { RemoveWalletConfirmationModal } from '../../components/modal/confirmation/RemoveWalletConfirmationModal'
import { AssetIcon } from '../../components/uielements/assets/assetIcon/AssetIcon'
import { QRCodeModal } from '../../components/uielements/qrCodeModal/QRCodeModal'
import { PhraseCopyModal } from '../../components/wallet/phrase/PhraseCopyModal'
import { getChainAsset, isArbChain, isAvaxChain, isBscChain, isEthChain } from '../../helpers/chainHelper'
import { isEvmChain } from '../../helpers/evmHelper'
import { eqChain, eqString } from '../../helpers/fp/eq'
import { emptyString } from '../../helpers/stringHelper'
import { getWalletNamesFromKeystoreWallets, isEnabledLedger } from '../../helpers/walletHelper'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import * as appRoutes from '../../routes/app'
import * as walletRoutes from '../../routes/wallet'
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
import { BorderButton, FlatButton, TextButton } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { Tooltip, WalletTypeLabel } from '../uielements/common/Common.styles'
import { InfoIcon } from '../uielements/info'
import { Modal } from '../uielements/modal'
import { WalletSelector } from '../uielements/wallet'
import { EditableWalletName } from '../uielements/wallet/EditableWalletName'
import * as CStyled from './Common.styles'
import * as Styled from './WalletSettings.styles'

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
  collapsed: boolean
  toggleCollapse: FP.Lazy<void>
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
    collapsed,
    toggleCollapse,
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
    [ARBChain]: 0
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
    [ARBChain]: 0
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
          walletIndex,
          walletAccount,
          hdMode:
            isEthChain(chain) || isArbChain(chain) || isAvaxChain(chain) || isBscChain(chain) ? evmHDMode : 'default' // other Ledgers uses `default` path @St0mrzy note bsc & avax not ready yet for ledger
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

        const selectedWalletIndex = walletIndexMap[chain]
        const selectedAccountIndex = walletAccountMap[chain]

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
                            path: getEvmDerivationPath(walletAccountMap[chain], walletIndexMap[chain], 'ledgerlive')
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
                          { path: getEvmDerivationPath(walletAccountMap[chain], walletIndexMap[chain], 'ledgerlive') }
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
                          { path: getEvmDerivationPath(walletAccountMap[chain], walletIndexMap[chain], 'ledgerlive') }
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
                <Styled.RemoveLedgerIcon onClick={() => removeLedgerAddress(chain)} />
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
  const [filteredAssets, setFilteredAssets] = useState<{ [key in Chain]?: Asset[] }>({})

  const [isAddingByChain, setIsAddingByChain] = useState<{ [key in Chain]?: boolean }>({})

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

    let matchedAssets: Asset[]
    switch (chain) {
      case ETHChain:
        matchedAssets = ERC20_WHITELIST.filter(
          ({ asset }) => asset.symbol.toUpperCase().includes(searchValue) && !asset.synth
        ).map(({ asset }) => asset)
        break
      case AVAXChain:
        matchedAssets = AVAX_TOKEN_WHITELIST.filter(
          ({ asset }) => asset.symbol.toUpperCase().includes(searchValue) && !asset.synth
        ).map(({ asset }) => asset)
        break
      case BSCChain:
        matchedAssets = BSC_TOKEN_WHITELIST.filter(
          ({ asset }) => asset.symbol.toUpperCase().includes(searchValue) && !asset.synth
        ).map(({ asset }) => asset)
        break
      case ARBChain:
        matchedAssets = ARB_TOKEN_WHITELIST.filter(
          ({ asset }) => asset.symbol.toUpperCase().includes(searchValue) && !asset.synth
        ).map(({ asset }) => asset)
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

  const addAssetToStorage = useCallback((asset: Asset, chain: Chain) => {
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
                  {/* keystore */}
                  {renderKeystoreAddress(chain, keystore)}
                  {/* ledger */}
                  {isEnabledLedger(chain, network) && isSupportedChain(chain)
                    ? renderLedgerAddress(chain, oLedger)
                    : renderLedgerNotSupported}
                </div>
                <div className="mx-40px mt-10px w-full">
                  <SwitchButton active={enabledChains.includes(chain)} onChange={() => toggleChain(chain)} />
                  <span className="ml-2 text-text0 dark:text-text0d">
                    {enabledChains.includes(chain)
                      ? intl.formatMessage({ id: 'common.disable' }, { chain: chain })
                      : intl.formatMessage({ id: 'common.enable' }, { chain: chain })}
                  </span>
                </div>
                {(chain === ETHChain || chain === AVAXChain || chain === BSCChain || chain === ARBChain) && (
                  <div className="mx-40px mt-10px flex w-full items-center">
                    <SwitchButton
                      active={!!isAddingByChain[chain]} // Use the toggle state for the specific chain
                      onChange={() => toggleStorageMode(chain)} // Pass the specific chain to toggle the state
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
                      {(filteredAssets[chain] || []).map((asset: Asset) => (
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
    <div className="mt-40px bg-bg0 px-40px py-10px dark:bg-bg0d">
      <CStyled.Collapse
        expandIcon={({ isActive }) => <CStyled.ExpandIcon rotate={isActive ? 90 : 0} />}
        activeKey={collapsed ? '0' : '1'}
        expandIconPosition="end"
        onChange={toggleCollapse}
        ghost>
        <Collapse.Panel
          header={<CStyled.Title>{intl.formatMessage({ id: 'setting.wallet.title' })}</CStyled.Title>}
          key={'1'}>
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
          <div className="card my-20px w-full ">
            <h1 className="p-20px font-main text-18 uppercase text-text0 dark:text-text0d">
              {intl.formatMessage({ id: 'setting.wallet.management' })}
            </h1>
            <EditableWalletName
              name={walletName}
              names={walletNames}
              onChange={changeWalletNameHandler}
              loading={RD.isPending(renameWalletState)}
            />
            {renderRenameWalletError}
            <div className="mt-30px flex flex-col items-center md:flex-row">
              <div className="flex w-full justify-center md:w-1/2">
                <TextButton
                  className="m-0 min-w-[200px] md:m-20px"
                  color="primary"
                  size="normal"
                  onClick={exportKeystoreHandler}>
                  {intl.formatMessage({ id: 'setting.export' })}
                </TextButton>
              </div>
              <div className="flex w-full justify-center md:w-1/2">
                <TextButton className="m-0 min-w-[200px] md:m-20px" color="warning" size="normal" onClick={lockWallet}>
                  {intl.formatMessage({ id: 'setting.lock' })} <UnlockOutlined />
                </TextButton>
              </div>
            </div>
            <div className="flex flex-col items-center md:flex-row">
              <div className="flex w-full justify-center md:w-1/2">
                <BorderButton
                  className="m-10px min-w-[200px] md:m-20px"
                  size="normal"
                  color="primary"
                  onClick={() => setShowPasswordModal(true)}>
                  {intl.formatMessage({ id: 'setting.view.phrase' })}
                </BorderButton>
              </div>
              <div className="flex w-full justify-center md:w-1/2">
                <BorderButton
                  className="m-10px min-w-[200px] md:m-20px"
                  size="normal"
                  color="error"
                  onClick={() => setShowRemoveWalletModal(true)}>
                  {intl.formatMessage({ id: 'wallet.remove.label' })}
                </BorderButton>
              </div>
            </div>
          </div>

          <div className="card mb-20px w-full ">
            <h1 className="p-20px text-center font-main text-18 uppercase text-text0 dark:text-text0d md:text-left">
              {intl.formatMessage({ id: 'setting.multiwallet.management' })}
            </h1>

            <div className="flex flex-col py-20px md:flex-row">
              <div className="flex w-full flex-col items-center justify-center md:w-1/2">
                <h2 className="w-full text-center font-main text-[12px] uppercase text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'wallet.add.another' })}
                </h2>
                <FlatButton
                  className="mt-5px min-w-[200px]"
                  size="normal"
                  color="primary"
                  onClick={() => navigate(walletRoutes.noWallet.path())}>
                  {intl.formatMessage({ id: 'wallet.add.label' })}
                </FlatButton>
              </div>
              <div className="mt-20px flex w-full flex-col items-center justify-center md:mt-0 md:w-1/2">
                <h2 className="w-full text-center font-main text-[12px] uppercase text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'wallet.change.title' })}
                </h2>
                <WalletSelector
                  className="min-w-[200px]"
                  disabled={RD.isPending(changeWalletState)}
                  wallets={wallets}
                  onChange={changeWalletHandler}
                />
                {renderChangeWalletError}
              </div>
            </div>
          </div>
          <div key={'accounts'} className="w-full">
            <Styled.AccountCard>
              <Styled.Subtitle>{intl.formatMessage({ id: 'setting.accounts' })}</Styled.Subtitle>
              <div className="mt-30px flex justify-center md:ml-10px md:justify-start">
                <Styled.Input
                  prefix={<SearchOutlined />}
                  onChange={filterAccounts}
                  allowClear
                  placeholder={intl.formatMessage({ id: 'common.search' }).toUpperCase()}
                  size="large"
                />
              </div>
              {renderAccounts}
            </Styled.AccountCard>
          </div>
        </Collapse.Panel>
      </CStyled.Collapse>
    </div>
  )
}
