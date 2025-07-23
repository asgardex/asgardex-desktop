import { useMemo } from 'react'

import { ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { array as A, function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import AllIcon from '../../assets/svg/filter-all.svg?react'
import { getTxTypeI18n } from '../../helpers/actionsHelper'
import { Dropdown } from '../uielements/dropdown'
import { Label } from '../uielements/label'
import { TxType } from '../uielements/txType'
import { Filter } from './types'

type Props = {
  className?: string
  currentFilter: Filter
  onFilterChanged: (targetFilter: Filter) => void
  disabled?: boolean
  availableFilters: Filter[]
}

export const PoolActionsHistoryFilter = ({ currentFilter, onFilterChanged, className, availableFilters }: Props) => {
  const intl = useIntl()

  const allItemContent = useMemo(
    () => (
      <div className="flex items-center">
        <div className="w-8 h-8 flex items-center justify-center">
          <AllIcon />
        </div>
        <Label className="!w-auto ml-10px " size="big" textTransform="uppercase">
          {intl.formatMessage({ id: 'common.all' })}
        </Label>
      </div>
    ),
    [intl]
  )

  const menu = useMemo(() => {
    return FP.pipe(
      availableFilters,
      A.map((filter) => {
        const content = filter === 'ALL' ? allItemContent : <TxType type={filter} showTypeIcon />

        return (
          <div key={filter} className="w-full pr-1" onClick={() => onFilterChanged(filter)}>
            {content}
          </div>
        )
      })
    )
  }, [availableFilters, allItemContent, onFilterChanged])

  return (
    <Dropdown
      trigger={
        <div
          className={clsx(
            'flex items-center justify-between cursor-pointer border border-solid border-turquoise rounded px-2 py-1',
            className
          )}>
          <Label className="!w-auto" color="primary" size="big">
            {currentFilter === 'ALL' ? intl.formatMessage({ id: 'common.all' }) : getTxTypeI18n(currentFilter, intl)}
          </Label>
          <ChevronRightIcon className="ml-4 text-turquoise" width={16} height={16} />
        </div>
      }
      options={menu}
    />
  )
}
