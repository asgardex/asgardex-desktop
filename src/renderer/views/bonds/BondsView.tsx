import { useCallback, useState } from 'react'

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useSearchParams } from 'react-router-dom'

import { WalletType } from '../../../shared/wallet/types'
import { SegmentedTabs, formatCountdown } from '../../components/Bonds/provider'
import { WarningView } from '../../components/shared/warning'
import { BaseButton } from '../../components/uielements/button'
import { Protocol } from '../../components/uielements/protocolSwitch/types'
import { useWalletContext } from '../../contexts/WalletContext'
import { useNextChurn } from '../../hooks/useNextChurn'
import { BondsTab, TAB_QUERY_PARAM, isBondsTab } from '../../routes/bonds'
import { RUNEBOND_URL } from '../../services/runebond'
import { useApp } from '../../store/app/hooks'
import { LegacyBondsView } from './LegacyBondsView'
import { BondProviderDashboardView } from './provider/BondProviderDashboardView'
import { NodeOperatorView } from './provider/NodeOperatorView'

export const BondsView = (): JSX.Element => {
  const intl = useIntl()
  const { protocol } = useApp()
  const { appWalletService } = useWalletContext()

  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get(TAB_QUERY_PARAM)
  const [tab, setTab] = useState<BondsTab>(isBondsTab(initialTab) ? initialTab : BondsTab.BondProvider)

  const openRunebond = useCallback(() => window.apiUrl.openExternal(RUNEBOND_URL), [])
  const nextChurn = useNextChurn()

  if (protocol === Protocol.MAYAChain) return <LegacyBondsView />
  if (appWalletService.getCurrentWalletType() === WalletType.Vultisig) {
    return <WarningView subTitle={intl.formatMessage({ id: 'wallet.vultisig.notImplemented' })} />
  }

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-4 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs
          options={[
            { label: intl.formatMessage({ id: 'bonds.provider.tab.bondProvider' }), value: BondsTab.BondProvider },
            { label: intl.formatMessage({ id: 'bonds.provider.tab.nodeOperator' }), value: BondsTab.NodeOperator }
          ]}
          value={tab}
          onChange={setTab}
        />
        {FP.pipe(
          nextChurn,
          O.fold(
            () => null,
            ({ msLeft }) => (
              <div className="flex items-center gap-2">
                <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-turquoise" />
                <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
                  {intl.formatMessage({ id: 'bonds.provider.nextChurn' })}
                </span>
                <span className="font-main-semi-bold text-[14px] text-text0 dark:text-text0d">
                  {formatCountdown(msLeft)}
                </span>
              </div>
            )
          )
        )}
        <div className="flex items-center gap-3">
          <span className="font-main text-[14px] text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.provider.findNodeHint' })}
          </span>
          <BaseButton
            className="group !p-0 font-main-semi-bold text-[14px] text-turquoise uppercase"
            onClick={openRunebond}>
            runebond.com
            <ArrowTopRightOnSquareIcon className="ml-1 h-[16px] w-[16px] text-inherit" />
          </BaseButton>
        </div>
      </div>
      {tab === BondsTab.BondProvider ? <BondProviderDashboardView /> : <NodeOperatorView />}
    </div>
  )
}
