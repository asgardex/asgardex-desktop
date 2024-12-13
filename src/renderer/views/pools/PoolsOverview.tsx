import { Fragment, useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Tab } from '@headlessui/react'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate } from 'react-router'
import * as RxOp from 'rxjs/operators'

import { Tooltip } from '../../components/uielements/common/Common.styles'
import { RadioGroup } from '../../components/uielements/radioGroup'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import * as poolsRoutes from '../../routes/pools'
import { AVAILABLE_DEXS } from '../../services/const'
import { PoolType } from '../../services/midgard/types'
import { LoansOverview } from '../loans/LoansOverview'
import { SaversOverview } from '../savers/SaversOverview'
import { ActivePools } from './ActivePools'
import { PendingPools } from './PendingPools'

type TabType = PoolType | 'savers' | 'lending'

const TAB_INDEX: Record<TabType, number> = {
  active: 0,
  pending: 1,
  savers: 2,
  lending: 3
}

type TabContent = {
  index: number
  label: string
  content: JSX.Element
}

export const PoolsOverview = (): JSX.Element => {
  const intl = useIntl()
  const [protocol, setProtocol] = useState<Chain>(THORChain)

  const navigate = useNavigate()

  const { locked: walletLocked } = useKeystoreState()

  const {
    service: {
      pools: { haltedChains$ }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { haltedChains$: haltedChainsMaya$ }
    }
  } = useMidgardMayaContext()

  const [haltedChains] = useObservableState(
    () =>
      FP.pipe(protocol === THORChain ? haltedChains$ : haltedChainsMaya$, RxOp.map(RD.getOrElse((): Chain[] => []))),
    []
  )

  const { mimirHalt } = useThorchainMimirHalt()

  const matchPoolsPendingRoute = useMatch({ path: poolsRoutes.pending.path(), end: false })
  const matchPoolsSaversRoute = useMatch({ path: poolsRoutes.savers.path(), end: false })
  const matchPoolsLendingRoute = useMatch({ path: poolsRoutes.lending.path(), end: false })

  const activeIndex = useMemo(() => {
    const currentIndex = AVAILABLE_DEXS.findIndex((availableDex) => availableDex.chain === protocol)
    return currentIndex ?? 0
  }, [protocol])

  const toggleProtocol = useCallback((index: number) => {
    setProtocol(AVAILABLE_DEXS[index].chain)
  }, [])

  const selectedIndex: number = useMemo(() => {
    if (matchPoolsSaversRoute) {
      return TAB_INDEX['savers']
    } else if (matchPoolsPendingRoute) {
      return TAB_INDEX['pending']
    } else if (matchPoolsLendingRoute) {
      return TAB_INDEX['lending']
    } else {
      return TAB_INDEX['active']
    }
  }, [matchPoolsLendingRoute, matchPoolsPendingRoute, matchPoolsSaversRoute])

  const tabs = useMemo(
    (): TabContent[] => [
      {
        index: TAB_INDEX['active'],
        label: intl.formatMessage({ id: 'pools.available' }),
        content: <ActivePools protocol={protocol} />
      },
      {
        index: TAB_INDEX['pending'],
        label: intl.formatMessage({ id: 'pools.pending' }),
        content: <PendingPools protocol={protocol} />
      },
      {
        index: TAB_INDEX['savers'],
        label: intl.formatMessage({ id: 'common.savers' }),
        content: <SaversOverview haltedChains={haltedChains} mimirHalt={mimirHalt} walletLocked={walletLocked} />
      },
      {
        index: TAB_INDEX['lending'],
        label: intl.formatMessage({ id: 'common.lending' }),
        content: <LoansOverview haltedChains={haltedChains} mimirHalt={mimirHalt} walletLocked={walletLocked} />
      }
    ],
    [intl, protocol, haltedChains, mimirHalt, walletLocked]
  )

  const protocolOptions = useMemo(() => {
    return [
      {
        label: (
          <Tooltip title="Switch pools to THORChain" placement="bottom">
            <span className="px-1 text-text2 dark:text-text2d">THORChain</span>
          </Tooltip>
        ),
        value: THORChain
      },
      {
        label: (
          <Tooltip title="Switch pools to MAYAChain" placement="bottom">
            <span className="px-1 text-text2 dark:text-text2d">MAYAChain</span>
          </Tooltip>
        ),
        value: MAYAChain
      }
    ]
  }, [])

  const renderProtocolSwitch = useMemo(() => {
    return <RadioGroup options={protocolOptions} activeIndex={activeIndex} onChange={toggleProtocol} />
  }, [activeIndex, protocolOptions, toggleProtocol])

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
          case TAB_INDEX['savers']:
            navigate(poolsRoutes.savers.path())
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
        {renderProtocolSwitch}
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
