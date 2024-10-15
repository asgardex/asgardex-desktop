import React, { useCallback, useState } from 'react'

import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { Address, assetToString, AssetType, Chain } from '@xchainjs/xchain-util'
import { AnyAsset } from '@xchainjs/xchain-util'
import { Row, Col } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { Dex, mayaDetails, thorDetails } from '../../../../shared/api/types'
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
import { WarningView } from '../../shared/warning'
import { AssetInfo } from '../../uielements/assets/assetInfo'
import { BackLinkButton } from '../../uielements/button'
import { BorderButton, FlatButton, RefreshButton, TextButton } from '../../uielements/button'
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
  dex: Dex
  changeDex: (dex: Dex) => void
  haltedChains: Chain[]
}

export const AssetDetails: React.FC<Props> = (props): JSX.Element => {
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
    dex,
    haltedChains,
    changeDex
  } = props
  const [currentPage, setCurrentPage] = useState(1)

  const { chain } = asset.type === AssetType.SYNTH ? dex.asset : asset

  const navigate = useNavigate()
  const intl = useIntl()

  const isHaltedChain = haltedChains.includes(chain)
  const disableSwap = isHaltedChain || AssetHelper.isMayaAsset(asset)
  const disableAdd = isHaltedChain || AssetHelper.isMayaAsset(asset)

  // If the chain is not halted, perform the action

  const walletActionSendClick = useCallback(() => {
    navigate(walletRoutes.send.path())
  }, [navigate])

  const walletActionSwapClick = useCallback(() => {
    // Determine if the asset's chain is supported by the current DEX
    const currentChainSupported = dex.chain === 'MAYA' ? isChainOfMaya(chain) : isChainOfThor(chain)

    // If the current DEX doesn't support the asset's chain, switch DEXes
    if (!currentChainSupported) {
      const newDex = dex.chain === 'MAYA' ? thorDetails : mayaDetails
      changeDex(newDex)
    }

    const path = poolsRoutes.swap.path({
      source: assetToString(asset),
      target: assetToString(AssetHelper.isRuneNativeAsset(asset) ? AssetBTC : AssetRuneNative),
      sourceWalletType: walletType,
      targetWalletType: DEFAULT_WALLET_TYPE
    })
    navigate(path)
  }, [asset, chain, changeDex, dex, navigate, walletType])

  const walletActionManageClick = useCallback(() => {
    // Determine if the asset's chain is supported by the current DEX
    const currentChainSupported = dex.chain === 'MAYA' ? isChainOfMaya(chain) : isChainOfThor(chain)

    // If the current DEX doesn't support the asset's chain, switch DEXes
    if (!currentChainSupported) {
      const newDex = dex.chain === 'MAYA' ? thorDetails : mayaDetails
      changeDex(newDex)
    }
    const routeAsset = AssetHelper.isRuneNativeAsset(asset) || AssetHelper.isCacaoAsset(asset) ? AssetBTC : asset

    const path = poolsRoutes.deposit.path({
      asset: assetToString(routeAsset),
      assetWalletType: walletType,
      runeWalletType: DEFAULT_WALLET_TYPE
    })
    navigate(path)
  }, [asset, chain, changeDex, dex, navigate, walletType])

  const walletActionDepositClick = useCallback(() => {
    const path = walletRoutes.interact.path({
      interactType: 'bond'
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

  return (
    <>
      <Row justify="space-between">
        <Col>
          <BackLinkButton path={walletRoutes.assets.path()} />
        </Col>
        <Col>
          <RefreshButton onClick={refreshHandler} />
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <AssetInfo
            walletInfo={O.some({
              address: walletAddress,
              network,
              walletType
            })}
            asset={O.some(asset)}
            assetsWB={oBalances}
            network={network}
          />
        </Col>

        <Styled.Divider />

        <Styled.ActionRow>
          <Styled.ActionWrapper>
            <Styled.ActionCol>
              <Row justify="space-between">
                <FlatButton
                  className="m-2 ml-2 min-w-[200px]"
                  size="large"
                  color="primary"
                  onClick={disableSend ? undefined : walletActionSendClick}
                  disabled={disableSend}>
                  {intl.formatMessage({ id: 'wallet.action.send' })}
                </FlatButton>
                <FlatButton
                  className="m-2 ml-2 min-w-[200px]"
                  size="large"
                  color="primary"
                  onClick={disableSwap ? undefined : walletActionSwapClick}
                  disabled={disableSwap}>
                  {intl.formatMessage({ id: 'common.swap' })}
                </FlatButton>
                {asset.type !== AssetType.SYNTH && (
                  <FlatButton
                    className="m-2 ml-2 min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={disableAdd ? undefined : walletActionManageClick}
                    disabled={disableAdd}>
                    {intl.formatMessage({ id: 'common.manage' })}
                  </FlatButton>
                )}
                {AssetHelper.isRuneNativeAsset(asset) && (
                  <BorderButton
                    className="m-2 ml-2 min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={disableSend ? undefined : walletActionDepositClick}
                    disabled={disableSend}>
                    {intl.formatMessage({ id: 'wallet.action.deposit' })}
                  </BorderButton>
                )}
                {AssetHelper.isCacaoAsset(asset) && (
                  <BorderButton
                    className="m-2 ml-2 min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={disableSend ? undefined : walletActionDepositClick}
                    disabled={disableSend}>
                    {intl.formatMessage({ id: 'wallet.action.deposit' })}
                  </BorderButton>
                )}
              </Row>
            </Styled.ActionCol>
          </Styled.ActionWrapper>
        </Styled.ActionRow>
        <Styled.Divider />
      </Row>
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
