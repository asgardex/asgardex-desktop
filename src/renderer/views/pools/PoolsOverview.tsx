import { Fragment, useMemo } from 'react'

import { Tab } from '@headlessui/react'
import clsx from 'clsx'
import { function as FP, array as A } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate } from 'react-router'

import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import * as poolsRoutes from '../../routes/pools'
import { PoolType } from '../../services/midgard/midgardTypes'
import { useApp } from '../../store/app/hooks'
import { ActivePools } from './ActivePools'
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

  const selectedIndex: number = useMemo(() => {
    if (matchPoolsPendingRoute) {
      return TAB_INDEX['pending']
    } else {
      return TAB_INDEX['active']
    }
  }, [matchPoolsPendingRoute])

  const tabs = useMemo(
    (): TabContent[] => [
      {
        index: TAB_INDEX['active'],
        label: intl.formatMessage({ id: 'pools.available' }),
        content: <ActivePools />
      },
      {
        index: TAB_INDEX['pending'],
        label: intl.formatMessage({ id: 'pools.pending' }),
        content: <PendingPools />
      }
    ],
    [intl]
  )

  return (
    <Tab.Group
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
        <Tab.List className="mb-10px flex w-full flex-col md:flex-row">
          {FP.pipe(
            tabs,
            A.map(({ index, label }) => (
              <Tab key={index} as={Fragment}>
                {({ selected }) => (
                  // label wrapper
                  <div className="group flex cursor-pointer items-center justify-center focus-visible:outline-none">
                    {/* label */}
                    <span
                      className={clsx(
                        'ease border-y-[2px] border-solid border-transparent px-5px',
                        'font-mainSemiBold text-[16px] uppercase',
                        'mr-0 md:mr-10px',
                        'hover:text-turquoise group-hover:border-b-turquoise',
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
        </Tab.List>
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
      </div>
      <Tab.Panels className="mt-2 w-full">
        {FP.pipe(
          tabs,
          A.map(({ content, index }) => <Tab.Panel key={`content-${index}`}>{content}</Tab.Panel>)
        )}
      </Tab.Panels>
    </Tab.Group>
  )
}
