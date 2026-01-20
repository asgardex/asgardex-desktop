import { Radio as HeadlessRadio, RadioProps } from '@headlessui/react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

export { RadioGroup } from '@headlessui/react'

export const Radio = ({ children, ...rest }: RadioProps) => {
  return (
    <HeadlessRadio {...rest}>
      {({ checked, ...restBagSlots }) => (
        <div className="flex cursor-pointer items-center">
          {checked ? (
            <CheckCircleIcon className="mr-1 size-6 min-w-6 text-turquoise" />
          ) : (
            <div className="mr-1 flex size-6 min-w-6 items-center justify-center">
              <span className="h-[18px] w-[18px] min-w-[18px] rounded-full border-2 border-turquoise" />
            </div>
          )}
          {typeof children === 'function' ? children({ checked, ...restBagSlots }) : children}
        </div>
      )}
    </HeadlessRadio>
  )
}
