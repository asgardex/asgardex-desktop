import { useState, useRef, useLayoutEffect } from 'react'
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { Label } from '../label'

type Placement = 'top' | 'bottom' | 'left' | 'right'

type TooltipProps = {
  title: string
  children: React.ReactNode
  size?: 'small' | 'big'
  placement?: Placement
}

const base = 'z-50 px-2 py-1 text-xs text-white bg-bg0d/80 rounded-md shadow-lg whitespace-normal break-words relative'

const arrowBase = 'absolute w-0 h-0 border-transparent'
const arrowPlacements: Record<Placement, string> = {
  top: 'left-1/2 -translate-x-1/2 top-full border-x-4 border-t-4 border-b-0 border-x-transparent border-t-bg0d/80',
  bottom:
    'left-1/2 -translate-x-1/2 bottom-full border-x-4 border-b-4 border-t-0 border-x-transparent border-b-bg0d/80',
  left: 'top-1/2 -translate-y-1/2 left-full border-y-4 border-l-4 border-r-0 border-y-transparent border-l-bg0d/80',
  right: 'top-1/2 -translate-y-1/2 right-full border-y-4 border-r-4 border-l-0 border-y-transparent border-r-bg0d/80'
}

export const Tooltip = ({ title, size = 'small', children, placement = 'top' }: TooltipProps) => {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width?: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (show && wrapperRef.current && tooltipRef.current) {
      const targetRect = wrapperRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      let top = 0
      let left = 0

      switch (placement) {
        case 'top':
          top = targetRect.top + window.scrollY - tooltipRect.height - 8
          left = targetRect.left + window.scrollX + targetRect.width / 2 - tooltipRect.width / 2
          break
        case 'bottom':
          top = targetRect.bottom + window.scrollY + 8
          left = targetRect.left + window.scrollX + targetRect.width / 2 - tooltipRect.width / 2
          break
        case 'left':
          top = targetRect.top + window.scrollY + targetRect.height / 2 - tooltipRect.height / 2
          left = targetRect.left + window.scrollX - tooltipRect.width - 8
          break
        case 'right':
          top = targetRect.top + window.scrollY + targetRect.height / 2 - tooltipRect.height / 2
          left = targetRect.right + window.scrollX + 8
          break
      }

      // Clamp to viewport
      let adjustedLeft = left
      let adjustedWidth: number | undefined = undefined

      const margin = 8
      if (left < margin) {
        adjustedWidth = tooltipRect.width - (margin - left)
        adjustedLeft = margin
      } else if (left + tooltipRect.width > viewportWidth - margin) {
        adjustedWidth = viewportWidth - margin - left
      }

      setCoords({ top, left: adjustedLeft, width: adjustedWidth })
    }
  }, [show, placement])

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}>
      {children}
      {show &&
        createPortal(
          <div
            ref={tooltipRef}
            className={clsx(base)}
            style={{
              position: 'absolute',
              top: coords ? coords.top : -9999,
              left: coords ? coords.left : -9999,
              maxWidth: coords?.width ? coords.width : size === 'small' ? '20rem' : '30rem' // fallback to a safe max
            }}>
            <Label color="white" size={size} textTransform={size === 'small' ? 'uppercase' : 'none'}>
              {title}
            </Label>
            <span className={clsx(arrowBase, arrowPlacements[placement])} />
          </div>,
          document.body
        )}
    </div>
  )
}
