import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'
import { Address, BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import {
  ChurnBars,
  RunebondUnavailablePanel,
  formatBpsAsPercent,
  formatChurnDate,
  formatRuneAmount
} from '../../../components/Bonds/provider'
import { OPERATOR_FEES_CHURNS } from '../../../components/Bonds/provider/OperatorFeesTile'
import { ErrorView } from '../../../components/shared/error'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { BaseButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { Tooltip } from '../../../components/uielements/tooltip'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useUserNodesContext } from '../../../contexts/UserNodesContext'
import { truncateAddress } from '../../../helpers/addressHelper'
import { logger } from '../../../helpers/logger'
import { hiddenString } from '../../../helpers/stringHelper'
import { operatorAddressesOf, operatorFeesWindow, useOperatorFees } from '../../../hooks/useOperatorFees'
import { useOperatorNodes } from '../../../hooks/useOperatorNodes'
import * as bondsRoutes from '../../../routes/bonds'
import { OperatorRewards } from '../../../services/runebond'
import { useApp } from '../../../store/app/hooks'
import { useBondProviderData } from './useBondProviderData'

const paidPayouts = (fees: OperatorRewards) => fees.payouts.filter(({ commissionAmount }) => commissionAmount.gt(0))

const csvEscape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

const CARD = 'rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d'
const KICKER = 'font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d'
const COLUMN = 'font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d'

export const OperatorFeesView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { isPrivate } = useApp()

  const { network, walletInfos, formatPrice, noThorAddress } = useBondProviderData()
  const { getNodeInfos$ } = useThorchainContext()
  const { userNodes$ } = useUserNodesContext()

  const walletAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])
  const nodesRD = useOperatorNodes({ walletAddresses, userNodes$, getNodeInfos$ })
  const operatorAddresses = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.map(operatorAddressesOf),
        RD.getOrElse<Error, Address[]>(() => [])
      ),
    [nodesRD]
  )
  const feesRD = useOperatorFees(operatorAddresses)

  const goBack = useCallback(() => navigate(bondsRoutes.basePathWithTab(bondsRoutes.BondsTab.NodeOperator)), [navigate])
  const openNode = useCallback(
    (nodeAddress: Address) =>
      navigate(bondsRoutes.node.path({ nodeAddress }), { state: { tab: bondsRoutes.BondsTab.NodeOperator } }),
    [navigate]
  )

  const exportCsv = useCallback(async (fees: OperatorRewards) => {
    const header = 'date,node_address,commission_rune,fee_bps'
    const rows = paidPayouts(fees).map(({ date, nodeAddress, commissionAmount, commissionBps }) =>
      [
        date.toISOString(),
        csvEscape(nodeAddress),
        baseToAsset(commissionAmount).amount().toFixed(8),
        commissionBps.toString()
      ].join(',')
    )
    try {
      await window.apiExport.saveCsv({
        fileName: `operator-fees-${new Date().toISOString().slice(0, 10)}.csv`,
        content: [header, ...rows].join('\n')
      })
    } catch (err) {
      logger.error('Failed to export operator fees CSV:', err)
    }
  }, [])

  const amount = (value: BaseAmount) => (isPrivate ? hiddenString : formatRuneAmount(value))

  const renderFees = (fees: OperatorRewards) => {
    const { total, average, lastChurn } = operatorFeesWindow(fees)
    const payouts = paidPayouts(fees)
    const truncatedNote =
      fees.payouts.length < fees.payoutsTotal
        ? intl.formatMessage(
            { id: 'bonds.operatorFees.page.truncated' },
            { shown: fees.payouts.length, total: fees.payoutsTotal }
          )
        : null
    const exportButton = (
      <BaseButton
        className="!p-0 font-main-semi-bold text-[12px] tracking-[1px] text-turquoise uppercase"
        onClick={() => void exportCsv(fees)}>
        {intl.formatMessage({ id: 'bonds.provider.rewards.exportCsv' })}
      </BaseButton>
    )

    return (
      <div className="flex w-full flex-col">
        <div className={`flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:justify-between ${CARD}`}>
          <div className="flex flex-col">
            <span className={KICKER}>{intl.formatMessage({ id: 'bonds.operatorFees.page.title' })}</span>
            <div className="mt-2 flex items-center gap-3">
              <AssetIcon asset={AssetRuneNative} size="normal" network={network} />
              <span className="font-main-bold text-[44px] leading-none text-text0 dark:text-text0d">
                {amount(total)}
              </span>
            </div>
            <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
              {FP.pipe(
                formatPrice(total),
                O.filter(() => !isPrivate),
                O.map((price) => `≈ ${price} · `),
                O.getOrElse(() => '')
              )}
              {intl.formatMessage(
                { id: 'bonds.operatorFees.page.summary' },
                { churns: OPERATOR_FEES_CHURNS, nodes: fees.byNode.length }
              )}
            </span>
            <span className="mt-1 font-main text-[13px] text-gray2 dark:text-gray2d">
              {intl.formatMessage(
                { id: 'bonds.operatorFees.page.allTime' },
                { amount: amount(fees.totals.totalPaid), count: fees.totals.churnCount }
              )}
            </span>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className={KICKER}>{intl.formatMessage({ id: 'bonds.operatorFees.page.avgPerChurn' })}</span>
            <div className="mt-2 flex items-center gap-2">
              <AssetIcon asset={AssetRuneNative} size="small" network={network} />
              <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
                {amount(average)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className={KICKER}>{intl.formatMessage({ id: 'bonds.operatorFees.page.lastChurn' })}</span>
            <div className="mt-2 flex items-center gap-2">
              <AssetIcon asset={AssetRuneNative} size="small" network={network} />
              <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
                {lastChurn ? amount(lastChurn.amount) : '—'}
              </span>
            </div>
            {lastChurn && (
              <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
                {formatChurnDate(lastChurn.date, intl.locale)}
              </span>
            )}
          </div>
        </div>

        {fees.series.length > 0 && (
          <div className={`mt-6 flex w-full flex-col ${CARD}`}>
            <span className={KICKER}>{intl.formatMessage({ id: 'bonds.operatorFees.page.perChurn' })}</span>
            <div className="mt-4 h-[180px] w-full">
              <ChurnBars
                bars={fees.series.map(({ amount: value, date }) => ({
                  value: baseToAsset(value).amount().toNumber(),
                  label: `ᚱ${amount(value)} · ${formatChurnDate(date, intl.locale)}`
                }))}
              />
            </div>
            <div className="mt-2 flex w-full justify-between">
              <span className="font-main text-[12px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.provider.detail.churnsAgo' }, { count: fees.series.length })}
              </span>
              <span className="font-main text-[12px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.provider.detail.now' })}
              </span>
            </div>
          </div>
        )}

        <div className={`mt-6 flex w-full flex-col ${CARD}`}>
          <span className={KICKER}>{intl.formatMessage({ id: 'bonds.operatorFees.page.byNode' })}</span>
          {fees.byNode.length === 0 ? (
            <span className="mt-4 font-main text-[14px] text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.operatorFees.page.noPayouts' })}
            </span>
          ) : (
            <>
              <div className="mt-4 hidden items-center gap-6 px-2 pb-2 md:flex">
                <span className={`flex-1 ${COLUMN}`}>{intl.formatMessage({ id: 'bonds.operatorFees.page.node' })}</span>
                <span className={`w-[110px] text-right ${COLUMN}`}>
                  {intl.formatMessage({ id: 'bonds.operatorFees.page.churnsPaid' })}
                </span>
                <span className={`w-[170px] text-right ${COLUMN}`}>
                  {intl.formatMessage({ id: 'bonds.operatorFees.page.lastPayout' })}
                </span>
                <span className={`w-[140px] text-right ${COLUMN}`}>
                  {intl.formatMessage({ id: 'bonds.operatorFees.page.total' })}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-gray0 dark:divide-gray0d">
                {fees.byNode.map((node) => (
                  <div
                    key={node.nodeAddress}
                    role="button"
                    tabIndex={0}
                    className="group flex w-full cursor-pointer flex-wrap items-center gap-x-6 gap-y-1 px-2 py-4 focus-visible:outline-none"
                    onClick={() => openNode(node.nodeAddress)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openNode(node.nodeAddress)
                      }
                    }}>
                    <span className="min-w-0 flex-1 font-main text-[15px] text-text0 group-hover:text-turquoise dark:text-text0d">
                      {truncateAddress(node.nodeAddress, THORChain, network)}
                    </span>
                    <span className="w-[110px] text-right font-main text-[14px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage(
                        { id: 'bonds.operatorFees.page.churnsPaidValue' },
                        { count: node.churnsPaid }
                      )}
                    </span>
                    <span className="flex w-[170px] flex-col items-end font-main text-[14px] text-text0 dark:text-text0d">
                      {node.lastPayout ? (
                        <>
                          <span>ᚱ{amount(node.lastPayout.amount)}</span>
                          <span className="text-[12px] text-gray2 dark:text-gray2d">
                            {formatChurnDate(node.lastPayout.date, intl.locale)}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                    <span className="w-[140px] text-right font-main-semi-bold text-[15px] text-text0 dark:text-text0d">
                      ᚱ{amount(node.totalPaid)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={`mt-6 flex w-full flex-col ${CARD}`}>
          <div className="flex items-center justify-between">
            <span className={KICKER}>{intl.formatMessage({ id: 'bonds.operatorFees.page.payouts' })}</span>
            {payouts.length > 0 &&
              (truncatedNote ? (
                <Tooltip size="big" title={truncatedNote}>
                  {exportButton}
                </Tooltip>
              ) : (
                exportButton
              ))}
          </div>
          {payouts.length === 0 ? (
            <span className="mt-4 font-main text-[14px] text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.operatorFees.page.noPayouts' })}
            </span>
          ) : (
            <div className="mt-2 flex flex-col divide-y divide-gray0 dark:divide-gray0d">
              {payouts.map((payout) => (
                <div
                  key={`${payout.nodeAddress}-${payout.blockNumber}`}
                  className="flex items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
                      <span className="font-main-semi-bold text-[16px] text-text0 dark:text-text0d">
                        {amount(payout.commissionAmount)}
                      </span>
                    </div>
                    <span className="mt-1 truncate font-main text-[13px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage(
                        { id: 'bonds.operatorFees.page.payoutNode' },
                        {
                          node: truncateAddress(payout.nodeAddress, THORChain, network),
                          fee: formatBpsAsPercent(payout.commissionBps, intl.locale)
                        }
                      )}
                    </span>
                  </div>
                  <span className="shrink-0 font-main text-[14px] text-gray2 dark:text-gray2d">
                    {formatChurnDate(payout.date, intl.locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {truncatedNote && (
            <span className="mt-2 font-main text-[13px] text-gray2 dark:text-gray2d">{truncatedNote}</span>
          )}
        </div>
      </div>
    )
  }

  const renderNoOperatorNodes = () => (
    <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray0 p-10 dark:border-gray0d">
      <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.operatorFees.page.noOperatorNodes' })}
      </span>
    </div>
  )

  const renderContent = () => {
    if (noThorAddress) return renderNoOperatorNodes()
    if (!RD.isSuccess(nodesRD) || walletAddresses.length === 0) {
      return RD.isFailure(nodesRD) ? (
        <ErrorView title={intl.formatMessage({ id: 'bonds.nodes.error' })} subTitle={nodesRD.error.message} />
      ) : (
        <Spin className="m-auto" />
      )
    }
    if (operatorAddresses.length === 0) return renderNoOperatorNodes()
    return FP.pipe(
      feesRD,
      RD.fold(
        () => <Spin className="m-auto" />,
        () => <Spin className="m-auto" />,
        () => <RunebondUnavailablePanel className="min-h-[280px]" />,
        renderFees
      )
    )
  }

  return (
    <div className="flex flex-col items-start">
      <BaseButton className="group !p-0 font-main-semi-bold text-[14px] text-turquoise uppercase" onClick={goBack}>
        <ArrowLeftIcon className="mr-1 h-[16px] w-[16px] text-inherit transition-transform group-hover:-translate-x-[2px]" />
        {intl.formatMessage({ id: 'bonds.operator.detail.back' })}
      </BaseButton>
      <div className="mt-8 w-full">{renderContent()}</div>
    </div>
  )
}
