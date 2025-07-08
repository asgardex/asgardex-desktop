import { useCallback } from 'react'

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { Cog8ToothIcon } from '@heroicons/react/20/solid'
import { array as A, function as FP } from 'fp-ts'

import { ChangeSlipToleranceHandler } from '../../services/app/types'
import { SlipTolerance } from '../../types/asgardex'
import { BaseButton } from '../uielements/button'

const SLIP_PERCENTAGES: SlipTolerance[] = [1, 3, 5, 10, 15, 20]
export const SLIP_TOLERANCE_KEY = 'asgdx-slip-tolerance'

type Props = {
  value: SlipTolerance
  onChange: ChangeSlipToleranceHandler
}

export const SelectableSlipTolerance = ({ onChange, value }: Props): JSX.Element => {
  const changeSlipToleranceHandler = useCallback(
    (slipTolerance: SlipTolerance) => {
      localStorage.setItem(SLIP_TOLERANCE_KEY, slipTolerance.toString())
      onChange(slipTolerance)
    },
    [onChange]
  )

  return (
    <Popover className="relative">
      <PopoverButton className="group flex items-center">
        {value.toString()} %
        <Cog8ToothIcon className="ease ml-5px h-[15px] w-[15px] text-gray2 group-hover:rotate-180 dark:text-gray2d" />
      </PopoverButton>
      <PopoverPanel className="absolute z-10 translate-x-[-50%] translate-y-[-100%] bg-bg0 shadow-full dark:bg-bg0d dark:shadow-fulld ">
        {({ close }) => (
          <div>
            {FP.pipe(
              SLIP_PERCENTAGES,
              A.map((slip) => (
                <BaseButton
                  font={slip === value ? 'bold' : 'normal'}
                  className="w-full hover:bg-bg2 dark:hover:bg-bg2d"
                  key={slip}
                  onClick={() => {
                    changeSlipToleranceHandler(slip)
                    close()
                  }}>
                  {slip}%
                </BaseButton>
              ))
            )}
          </div>
        )}
      </PopoverPanel>
    </Popover>
  )
}
