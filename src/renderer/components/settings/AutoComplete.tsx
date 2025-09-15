import { useCallback, useState } from 'react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { Label } from '../uielements/label'

export const AutoComplete = ({
  placeholder,
  value: defaultValue,
  options,
  onChange
}: {
  value?: string
  placeholder: string
  options: { value: string }[]
  onChange: (address: string) => void
}) => {
  const [selected, setSelected] = useState(defaultValue)

  const handleChange = useCallback(
    (value: string) => {
      setSelected(value)
      onChange(value)
    },
    [onChange]
  )

  return (
    <Listbox onChange={handleChange}>
      <div className="relative">
        <ListboxButton
          className={clsx(
            'relative block w-full rounded-lg bg-bg0 dark:bg-bg0d py-1.5 pr-8 pl-3 text-left text-sm/6 text-text0 dark:text-text0d border border-solid border-gray0 dark:border-gray0d',
            'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-white/25'
          )}>
          <Label>{selected ? selected : placeholder.toUpperCase()}</Label>
          <ChevronDownIcon className="group pointer-events-none absolute top-2.5 right-2.5 size-4 stroke-text0 dark:stroke-text0d" />
        </ListboxButton>
      </div>
      <ListboxOptions
        anchor="bottom start"
        transition
        className="w-[--button-width] mt-1 px-2 py-2 rounded-md bg-bg0 dark:bg-bg0d border border-solid border-gray0 dark:border-gray0d">
        {options.map(({ value }) => (
          <ListboxOption
            className="rounded-md px-2 py-0.5 cursor-pointer flex items-center justify-between hover:bg-bg2 dark:hover:bg-bg2d"
            key={value}
            value={value}>
            <Label>{value}</Label>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  )
}
