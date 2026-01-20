import type { SVGProps } from 'react'

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import { Label, LabelProps } from '../label'

export const ExternalLinkIcon = ({ className, onClick, ...props }: SVGProps<SVGSVGElement>) => (
  <ArrowTopRightOnSquareIcon
    className={clsx('h-5 w-5 translate-x-1.5 text-text1 dark:text-text1d', onClick && 'cursor-pointer', className)}
    onClick={onClick}
    {...props}
  />
)

export const WalletTypeTinyLabel = ({ children, className, ...props }: LabelProps) => (
  <Label
    textTransform="uppercase"
    size="tiny"
    className={clsx(
      'w-auto! rounded-[5px] bg-gray0 px-[7px] py-px font-main text-text2 shadow-[1px_1px_1px] shadow-bg1',
      'dark:bg-gray0d dark:text-text2d dark:shadow-bg1d',
      className
    )}
    {...props}>
    {children}
  </Label>
)

export const WalletTypeLabel = ({ children, className, ...props }: LabelProps) => (
  <Label
    textTransform="uppercase"
    size="small"
    className={clsx(
      'w-auto! rounded-[5px] bg-gray0 px-[7px] py-px font-main text-text2 shadow-[1px_1px_1px] shadow-bg1',
      'dark:bg-gray0d dark:text-text2d dark:shadow-bg1d',
      className
    )}
    {...props}>
    {children}
  </Label>
)

export const AssetSynthLabel = ({ children, className, ...props }: LabelProps) => (
  <Label
    textTransform="uppercase"
    size="small"
    className={clsx(
      'bg-primary0 w-auto! rounded-[5px] px-[7px] py-px font-main text-text3',
      'dark:bg-primary0d dark:text-text3d',
      className
    )}
    {...props}>
    {children}
  </Label>
)

export const AssetSecuredLabel = ({ children, className, ...props }: LabelProps) => (
  <Label
    textTransform="uppercase"
    size="small"
    className={clsx('w-auto! rounded-[5px] bg-[#b224ec] px-[7px] py-px font-main text-text3', className)}
    {...props}>
    {children}
  </Label>
)
