import React, { useCallback, useMemo, useState } from 'react'

import {
  ArrowDownOnSquareIcon,
  ArrowRightOnRectangleIcon,
  ArrowsRightLeftIcon,
  ArrowUpOnSquareIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { Address, assetToString, AssetType, Chain } from '@xchainjs/xchain-util'
import { AnyAsset } from '@xchainjs/xchain-util'
import { Row, Col } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { chainToString, isChainOfMaya, isChainOfThor } from '../../../../shared/utils/chain'
import { WalletType } from '../../../../shared/wallet/types'
import { DEFAULT_WALLET_TYPE } from '../../../const'
import * as AssetHelper from '../../../helpers/assetHelper'
import * as poolsRoutes from '../../../routes/pools'
import * as walletRoutes from '../../../routes/wallet'
import { OpenExplorerTxUrl, TxsPageRD } from '../../../services/clients'
import { MAX_ITEMS_PER_PAGE } from '../../../services/const'
import { EMPTY_LOAD_TXS_HANDLER } from '../../../services/wallet/const'
import { LoadTxsHandler, NonEmptyWalletBalances } from '../../../services/wallet/types'
import { useApp } from '../../../store/app/hooks'
import { WarningView } from '../../shared/warning'
import { AssetInfo } from '../../uielements/assets/assetInfo'
import { BackLinkButton } from '../../uielements/button'
import { FlatButton, RefreshButton, TextButton } from '../../uielements/button'
import { ActionIconButton } from '../../uielements/button/ActionIconButton'
import { QRCodeModal } from '../../uielements/qrCodeModal'
import { InteractType } from '../txs/interact/Interact.types'
import { TxsTable } from '../txs/table/TxsTable'
import * as Styled from './AssetDetails.styles'

export type Props = {
  walletType: WalletType
  txsPageRD: TxsPageRD
  balances: O.Option<NonEmptyWalletBalances>
  asset: AnyAsset
  openExplorerTxUrl: OpenExplorerTxUrl
  openExplorerAddressUrl?: FP.Lazy<void>
  reloadBalancesHandler?: FP.Lazy<void>
  loadTxsHandler?: LoadTxsHandler
  walletAddress: Address
  disableSend: boolean
  network: Network
  haltedChainsThor: Chain[]
  haltedChainsMaya: Chain[]
}

export const AssetDetails = (props: Props): JSX.Element => {
  const {
    walletType,
    txsPageRD,
    balances: oBalances,
    asset,
    reloadBalancesHandler = FP.constVoid,
    loadTxsHandler = EMPTY_LOAD_TXS_HANDLER,
    openExplorerTxUrl,
    openExplorerAddressUrl,
    walletAddress,
    disableSend,
    network,
    haltedChainsThor,
    haltedChainsMaya
  } = props
  const [currentPage, setCurrentPage] = useState(1)
  const [showQRModal, setShowQRModal] = useState(false)
  const { protocol, setProtocol } = useApp()

  const dexAsset = useMemo(() => (protocol === THORChain ? AssetRuneNative : AssetCacao), [protocol])
  const { chain } = asset.type === AssetType.SYNTH ? dexAsset : asset

  const navigate = useNavigate()
  const intl = useIntl()

  const isResumedOnThor = isChainOfThor(chain) && !haltedChainsThor.includes(chain)
  const isResumedOnMaya = isChainOfMaya(chain) && !haltedChainsMaya.includes(chain)
  const disableSwap = (!isResumedOnThor && !isResumedOnMaya) || AssetHelper.isMayaAsset(asset)
  const disableAdd = (!isResumedOnThor && !isResumedOnMaya) || AssetHelper.isMayaAsset(asset)

  // If the chain is not halted, perform the action

  const walletActionSendClick = useCallback(() => {
    navigate(walletRoutes.send.path())
  }, [navigate])

  const walletActionSwapClick = useCallback(() => {
    // Determine if the asset's chain is supported by the current DEX
    const currentChainSupported = protocol === MAYAChain ? isResumedOnMaya : isResumedOnThor

    // If the current DEX doesn't support the asset's chain, switch DEXes
    if (!currentChainSupported) {
      const newProtocol = protocol === MAYAChain ? THORChain : MAYAChain
      setProtocol(newProtocol)
    }

    const path = poolsRoutes.swap.path({
      source: assetToString(asset),
      target: assetToString(AssetHelper.isRuneNativeAsset(asset) ? AssetBTC : AssetRuneNative),
      sourceWalletType: walletType,
      targetWalletType: DEFAULT_WALLET_TYPE
    })
    navigate(path)
  }, [protocol, isResumedOnMaya, isResumedOnThor, asset, walletType, navigate, setProtocol])

  const walletActionManageClick = useCallback(() => {
    // Determine if the asset's chain is supported by the current DEX
    const currentChainSupported = protocol === MAYAChain ? isResumedOnMaya : isResumedOnThor

    // If the current DEX doesn't support the asset's chain, switch DEXes
    if (!currentChainSupported) {
      const newProtocol = protocol === MAYAChain ? THORChain : MAYAChain
      setProtocol(newProtocol)
    }
    const routeAsset = AssetHelper.isRuneNativeAsset(asset) || AssetHelper.isCacaoAsset(asset) ? AssetBTC : asset

    const path = poolsRoutes.deposit.path({
      asset: assetToString(routeAsset),
      assetWalletType: walletType,
      runeWalletType: DEFAULT_WALLET_TYPE
    })
    navigate(path)
  }, [protocol, isResumedOnMaya, isResumedOnThor, asset, walletType, navigate, setProtocol])

  const walletActionDepositClick = useCallback(() => {
    const path = walletRoutes.interact.path({
      interactType: InteractType.Bond
    })
    navigate(path)
  }, [navigate])

  const reloadTxs = useCallback(() => {
    loadTxsHandler({ limit: MAX_ITEMS_PER_PAGE, offset: (currentPage - 1) * MAX_ITEMS_PER_PAGE })
  }, [currentPage, loadTxsHandler])

  const refreshHandler = useCallback(() => {
    reloadTxs()
    reloadBalancesHandler()
  }, [reloadBalancesHandler, reloadTxs])

  const onChangePagination = useCallback(
    (pageNo: number) => {
      loadTxsHandler({ limit: MAX_ITEMS_PER_PAGE, offset: (pageNo - 1) * MAX_ITEMS_PER_PAGE })
      setCurrentPage(pageNo)
    },
    [loadTxsHandler]
  )

  const closeQrModal = useCallback(() => setShowQRModal(false), [])

  const renderQRCodeModal = useMemo(() => {
    return (
      <QRCodeModal
        key="qr-modal"
        asset={asset}
        address={walletAddress}
        network={network}
        visible={showQRModal}
        onCancel={closeQrModal}
        onOk={closeQrModal}
      />
    )
  }, [asset, walletAddress, network, showQRModal, closeQrModal])

  return (
    <>
      {renderQRCodeModal}
      <Row justify="space-between">
        <Col>
          <BackLinkButton path={walletRoutes.assets.path()} />
        </Col>
        <Col>
          <RefreshButton onClick={refreshHandler} />
        </Col>
      </Row>
      <div className="flex flex-col space-y-8 rounded-xl bg-bg1 p-8 dark:bg-bg1d">
        <AssetInfo walletInfo={O.some({ walletType })} asset={O.some(asset)} assetsWB={oBalances} network={network} />

        <div className="w-full">
          <div className="flex flex-col items-center justify-center space-x-0 space-y-1 sm:flex-row sm:space-x-2 sm:space-y-0">
            <ActionIconButton
              icon={<ArrowUpOnSquareIcon className="h-6 w-6" />}
              text={intl.formatMessage({ id: 'wallet.action.send' })}
              onClick={walletActionSendClick}
              disabled={disableSend}
            />
            <ActionIconButton
              icon={<ArrowDownOnSquareIcon className="h-6 w-6" />}
              text={intl.formatMessage({ id: 'wallet.action.receive' })}
              onClick={() => setShowQRModal(true)}
            />
            <ActionIconButton
              icon={<ArrowsRightLeftIcon className="h-6 w-6" />}
              text={intl.formatMessage({ id: 'common.swap' })}
              onClick={walletActionSwapClick}
              disabled={disableSwap}
            />
            {asset.type !== AssetType.SYNTH && (
              <ActionIconButton
                icon={<ChartPieIcon className="h-6 w-6" />}
                text={intl.formatMessage({ id: 'common.manage' })}
                onClick={walletActionManageClick}
                disabled={disableAdd}
              />
            )}
            {(AssetHelper.isRuneNativeAsset(asset) || AssetHelper.isCacaoAsset(asset)) && (
              <ActionIconButton
                icon={<ArrowRightOnRectangleIcon className="h-6 w-6" />}
                text={intl.formatMessage({ id: 'wallet.action.deposit' })}
                onClick={walletActionDepositClick}
                disabled={disableSend}
              />
            )}
          </div>
        </div>
      </div>
      <Row>
        <Col span={24}>
          <TextButton
            className="px-0 pb-20px pt-40px !font-mainSemiBold !text-18"
            size="large"
            color="neutral"
            onClick={openExplorerAddressUrl}>
            {intl.formatMessage({ id: 'wallet.txs.history' })}
            <Styled.TableHeadlineLinkIcon />
          </TextButton>
        </Col>
        <Col span={24}>
          {asset.type === AssetType.SYNTH || asset === AssetRuneNative ? (
            <WarningView
              subTitle={intl.formatMessage(
                { id: 'wallet.txs.history.disabled' },
                { chain: `${chainToString(chain)} ${asset.type === AssetType.SYNTH ? 'synth' : ''}` }
              )}
              extra={
                <FlatButton size="normal" color="neutral" onClick={openExplorerAddressUrl}>
                  {intl.formatMessage({ id: 'wallet.txs.history' })}
                  <Styled.TableHeadlineLinkIcon />
                </FlatButton>
              }
            />
          ) : (
            <TxsTable
              txsPageRD={txsPageRD}
              clickTxLinkHandler={openExplorerTxUrl}
              changePaginationHandler={onChangePagination}
              chain={chain}
              network={network}
              walletAddress={walletAddress}
              reloadHandler={reloadTxs}
            />
          )}
        </Col>
      </Row>
    </>
  )
}
