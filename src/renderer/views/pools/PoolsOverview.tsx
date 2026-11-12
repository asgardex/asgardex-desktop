import { Fragment, useEffect, useMemo } from 'react'

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'
import { function as FP, array as A } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate } from 'react-router'

import { THORChain, MAYAChain } from '../../../shared/utils/chainIds'
import { ProtocolLimit } from '../../components/pool'
import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { Protocol } from '../../components/uielements/protocolSwitch/types'
import { selectProtocolLimit, useProtocolLimit } from '../../hooks/useProtocolLimit'
import { useProtocolLimitMaya } from '../../hooks/useProtocolLimitMaya'
import * as poolsRoutes from '../../routes/pools'
import { PoolType } from '../../services/midgard/midgardTypes'
import { useApp } from '../../store/app/hooks'
import { useHaltBannerSlot } from '../app/AppHaltedChains'
import { ActivePools } from './ActivePools'
import { ChainflipAssets } from './ChainflipAssets'
import { PendingPools } from './PendingPools'

type TabType = PoolType

const TAB_INDEX: Record<TabType, number> = {
  active: 0,
  pending: 1
}

type TabContent = {
  index: number
  label: string
  content: JSX.Element
}

export const PoolsOverview = (): JSX.Element => {
  const intl = useIntl()
  const { protocol, setProtocol } = useApp()

  const navigate = useNavigate()

  const matchPoolsPendingRoute = useMatch({ path: poolsRoutes.pending.path(), end: false })
  const isChainflip = protocol === Protocol.Chainflip
  const isThorProtocol = protocol === THORChain
  const haltBanner = useHaltBannerSlot()
  const { reload: reloadLimitThor, data: limitThorRD } = useProtocolLimit(isThorProtocol)
  const { reload: reloadLimitMaya, data: limitMayaRD } = useProtocolLimitMaya(protocol === MAYAChain)
  const reloadLimit = isThorProtocol ? reloadLimitThor : reloadLimitMaya

  // If user lands on /pools/pending while Chainflip is active, redirect to /pools/active
  useEffect(() => {
    if (isChainflip && matchPoolsPendingRoute) {
      navigate(poolsRoutes.active.path(), { replace: true })
    }
  }, [isChainflip, matchPoolsPendingRoute, navigate])

  const selectedIndex: number = useMemo(() => {
    if (matchPoolsPendingRoute && !isChainflip) {
      return TAB_INDEX['pending']
    } else {
      return TAB_INDEX['active']
    }
  }, [matchPoolsPendingRoute, isChainflip])

  const tabs = useMemo(
    (): TabContent[] => [
      {
        index: TAB_INDEX['active'],
        label: intl.formatMessage({ id: 'pools.available' }),
        content: isChainflip ? <ChainflipAssets /> : <ActivePools reloadLimit={reloadLimit} />
      },
      {
        index: TAB_INDEX['pending'],
        label: intl.formatMessage({ id: 'pools.pending' }),
        content: <PendingPools reloadLimit={reloadLimit} />
      }
    ],
    [intl, isChainflip, reloadLimit]
  )

  const visibleTabs = useMemo(
    () => (isChainflip ? tabs.filter((t) => t.index === TAB_INDEX['active']) : tabs),
    [tabs, isChainflip]
  )

  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={(index) => {
        switch (index) {
          case TAB_INDEX['active']:
            navigate(poolsRoutes.active.path())
            break
          case TAB_INDEX['pending']:
            navigate(poolsRoutes.pending.path())
            break
          default:
          // nothing to do
        }
      }}>
      <div className="flex flex-col items-center justify-between sm:flex-row">
        <TabList className="mb-10px flex w-full flex-col md:flex-row">
          {FP.pipe(
            visibleTabs,
            A.map(({ index, label }) => (
              <Tab key={index} as={Fragment}>
                {({ selected }) => (
                  // label wrapper
                  <div className="group flex cursor-pointer items-center justify-center focus-visible:outline-none">
                    {/* label */}
                    <span
                      className={clsx(
                        'ease border-y-[2px] border-solid border-transparent px-5px',
                        'font-main-semi-bold text-[16px] uppercase',
                        'mr-0 md:mr-10px',
                        'group-hover:border-b-turquoise hover:text-turquoise',
                        selected
                          ? 'border-b-turquoise text-turquoise'
                          : 'border-b-transparent text-text2 dark:text-text2d'
                      )}>
                      {label}
                    </span>
                  </div>
                )}
              </Tab>
            ))
          )}
        </TabList>
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
      </div>
      {/* Same slot for the network ticker and the protocol limit, under the tabs on every protocol.
          empty:hidden drops the margin when neither has anything to show. */}
      <div className="mt-3 flex w-full flex-col gap-2 empty:hidden">
        {haltBanner}
        <ProtocolLimit
          key={`limit-${protocol}`}
          limit={selectProtocolLimit(protocol, limitThorRD, limitMayaRD)}
          protocol={protocol}
        />
      </div>
      <TabPanels className="mt-2 w-full">
        {FP.pipe(
          visibleTabs,
          A.map(({ content, index }) => <TabPanel key={`content-${index}`}>{content}</TabPanel>)
        )}
      </TabPanels>
    </TabGroup>
  )
}
