import { Radio as HeadlessRadio, RadioProps } from '@headlessui/react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

export { RadioGroup } from '@headlessui/react'

export const Radio = ({ children, ...rest }: RadioProps) => {
  return (
    <HeadlessRadio {...rest}>
      {({ checked, ...restBagSlots }) => (
        <div className="flex items-center cursor-pointer">
          {checked ? (
            <CheckCircleIcon className="mr-1 text-turquoise min-w-6 size-6" />
          ) : (
            <div className="flex items-center justify-center min-w-6 mr-1 size-6">
              <span className="min-w-[18px] w-[18px] h-[18px] rounded-full border-[2px] border-turquoise" />
            </div>
          )}
          {typeof children === 'function' ? children({ checked, ...restBagSlots }) : children}
        </div>
      )}
    </HeadlessRadio>
  )
}
