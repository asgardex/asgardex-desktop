import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

type Props = {
  className?: string
  header: React.ReactNode
  children: React.ReactNode
  isOpen?: boolean
  onToggle?: () => void
}

export const Collapse = ({ className, header, children, isOpen, onToggle }: Props): JSX.Element => {
  return (
    <Disclosure
      as="div"
      {...(isOpen !== undefined ? { defaultOpen: isOpen } : {})}
      className={clsx('flex flex-col rounded-lg border border-solid border-gray0 dark:border-gray0d', className)}>
      {({ open }) => (
        <>
          <DisclosureButton
            className="flex cursor-pointer flex-row items-center justify-between rounded-lg py-2 px-4"
            onClick={onToggle}>
            {header}
            <ChevronDownIcon className={clsx('size-5 text-turquoise', { 'rotate-180': open })} />
          </DisclosureButton>
          <DisclosurePanel className="rounded-b-lg">{children}</DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}
