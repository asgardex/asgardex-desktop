import React, { useMemo } from 'react'

import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { GetPoolsPeriodEnum } from '../../../services/midgard/midgardTypes'

type PeriodItem = { value: GetPoolsPeriodEnum; label: string }

const DEFAULT_ITEM: PeriodItem = { value: GetPoolsPeriodEnum._30d, label: '30 days' }

type Props = {
  selectedValue: GetPoolsPeriodEnum
  onChange: (value: GetPoolsPeriodEnum) => void
  className?: string
  disabled?: boolean
}

export const PoolsPeriodSelector = ({
  selectedValue,
  onChange,
  disabled = false,
  className = ''
}: Props): JSX.Element => {
  const intl = useIntl()

  const defaultItem: PeriodItem = useMemo(
    () => ({ value: GetPoolsPeriodEnum._30d, label: intl.formatMessage({ id: 'common.time.days' }, { days: '30' }) }),
    [intl]
  )

  const listItems: PeriodItem[] = useMemo(
    () => [
      { value: GetPoolsPeriodEnum._7d, label: intl.formatMessage({ id: 'common.time.days' }, { days: '7' }) },
      defaultItem, // 30 days
      { value: GetPoolsPeriodEnum._90d, label: intl.formatMessage({ id: 'common.time.days' }, { days: '90' }) },
      { value: GetPoolsPeriodEnum._180d, label: intl.formatMessage({ id: 'common.time.days' }, { days: '180' }) },
      { value: GetPoolsPeriodEnum._365d, label: intl.formatMessage({ id: 'common.time.days' }, { days: '365' }) }
    ],
    [defaultItem, intl]
  )

  const selectedItem: PeriodItem = FP.pipe(
    listItems,
    // get selected wallet
    A.findFirst(({ value }) => value === selectedValue),
    // use first if no wallet is selected
    O.getOrElse(() => DEFAULT_ITEM)
  )

  return (
    <Listbox
      value={selectedItem}
      disabled={disabled}
      onChange={({ value }) => {
        onChange(value)
      }}>
      <div
        className={clsx('relative', className)}
        onClick={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
          event.preventDefault()
          event.stopPropagation()
        }}>
        <ListboxButton
          as="div"
          className={clsx(
            'group flex items-center cursor-pointer',
            'bg-bg0 dark:bg-bg0d text-text0 dark:text-text0d',
            'py-5px pl-10px pr-10px',
            'font-main text-[12px] whitespace-nowrap',
            'transition duration-300 ease-in-out hover:shadow-full hover:dark:shadow-fulld',
            { 'opacity-70': disabled }
          )}>
          {({ open }) => (
            <>
              <span className="w-full">{selectedItem.label}</span>
              <ChevronDownIcon
                className={clsx('ml-2 ease h-20px w-20px group-hover:rotate-180', { 'rotate-180': open })}
              />
            </>
          )}
        </ListboxButton>
        <ListboxOptions
          className={clsx(
            'absolute z-[2000] mt-[0px] max-h-60 w-full overflow-auto',
            'border border-gray0 bg-bg0 focus:outline-none dark:border-gray0d dark:bg-bg0d'
          )}>
          {FP.pipe(
            listItems,
            A.map((item) => {
              const selected = item.value === selectedItem.value
              return (
                <ListboxOption
                  disabled={item.value === selectedItem.value}
                  className={({ selected }) =>
                    clsx(
                      'flex w-full select-none justify-center whitespace-nowrap',
                      'py-10px pl-20px pr-10px',
                      'font-main text-[12px]',
                      'text-text0 dark:text-text0d',
                      selected
                        ? 'cursor-disabled text-gray2 dark:text-gray2d'
                        : 'cursor-pointer hover:bg-gray0 hover:text-gray2 hover:dark:bg-gray0d hover:dark:text-gray2d'
                    )
                  }
                  key={item.value}
                  value={item}>
                  {item.label}
                  <CheckIcon
                    className={clsx('ml-1 h-20px w-20px text-turquoise', selected ? 'visible' : 'invisible')}
                  />
                </ListboxOption>
              )
            })
          )}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}
