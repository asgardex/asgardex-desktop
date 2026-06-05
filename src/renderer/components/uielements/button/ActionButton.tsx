import React from 'react'

import clsx from 'clsx'

import { Dropdown } from '../dropdown'
import { Label } from '../label'
import type { Color } from './Button.types'
import type { Props as ButtonProps } from './FlatButton'
import { FlatButton } from './index'

export type Action = {
  label: string
  callback: () => void
  disabled?: boolean
  color?: Color
  // Native HTML title — surfaces as a browser tooltip on hover. Used to explain
  // non-obvious states (e.g. why a swap button is in the 'impaired' style).
  title?: string
}

export type Props = Omit<ButtonProps, 'onClick'> & {
  actions: Action[]
  btnClassName?: string
  isTextView?: boolean
}

export const ActionButton = ({
  size,
  actions,
  isTextView = true,
  className = '',
  btnClassName = ''
}: Props): JSX.Element => {
  if (actions.length <= 3) {
    return (
      <div className={clsx('flex w-full justify-start space-x-2', className)}>
        {actions.map(({ label, callback, disabled = false, color, title }, index) => (
          <FlatButton
            className={clsx('group', btnClassName)} // Use FlatButton or TextButton as needed
            size={size}
            color={color}
            disabled={disabled}
            title={title}
            key={index}
            onClick={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
              event.preventDefault()
              event.stopPropagation()
              callback()
            }}>
            {isTextView && <span>{label}</span>}
          </FlatButton>
        ))}
      </div>
    )
  }

  return (
    <div className={clsx('flex w-full justify-start space-x-2', className)}>
      {actions.slice(0, 2).map(({ label, callback, disabled = false, color, title }, index) => (
        <FlatButton
          className={clsx('group', btnClassName)} // Use FlatButton or TextButton as needed
          size={size}
          color={color}
          disabled={disabled}
          title={title}
          key={index}
          onClick={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
            event.preventDefault()
            event.stopPropagation()
            callback()
          }}>
          {isTextView && <span>{label}</span>}
        </FlatButton>
      ))}
      <Dropdown
        anchor={{ to: 'bottom end', gap: 4, padding: 8 }}
        trigger={
          <div
            className={clsx(
              'rounded-full bg-turquoise hover:drop-shadow-lg',
              'cursor-pointer px-4 py-1',
              'transition duration-300 ease-in-out'
            )}
            onClick={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
              event.preventDefault()
              event.stopPropagation()
            }}>
            <Label size="big" color="white">
              ...
            </Label>
          </div>
        }
        options={actions.slice(2).map((action) => (
          <div
            className="p-2"
            key={action.label}
            onClick={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
              event.stopPropagation()
              action.callback()
            }}>
            <Label size="big" textTransform="uppercase">
              {action.label}
            </Label>
          </div>
        ))}
      />
    </div>
  )
}
