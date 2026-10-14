import { useId } from 'react'

import clsx from 'clsx'

const PATHS = [
  'M20.8139 23.9718L3.5382 33.9713L1 31.4332L16.1446 21.2569L20.8139 23.9718Z',
  'M21.2044 24.6481L3.9067 34.6096L4.83572 38.0768L21.2209 30.0494L21.2044 24.6481Z',
  'M21.8912 24.6481L39.1889 34.6096L38.2599 38.0768L21.8747 30.0494L21.8912 24.6481Z',
  'M22.2817 23.9718L39.5574 33.9713L42.0956 31.4331L26.951 21.2569L22.2817 23.9718Z',
  'M21.8912 23.2328L21.8692 3.27183L25.3364 2.34277L26.5771 20.5465L21.8912 23.2328Z',
  'M21.1102 23.2328L21.1322 3.27183L17.665 2.34277L16.4243 20.5465L21.1102 23.2328Z'
]

type Props = {
  className?: string
}

/**
 * Vultisig badge at the lock icon's size (viewBox 31×30).
 * The V is the official mark, scaled to the lock glyph and nudged up so the arms sit in the circle.
 */
export const VultisigMark = ({ className }: Props) => {
  const gradientId = `vultisig-mark-${useId().replace(/:/g, '')}`

  return (
    <svg className={clsx('block', className)} viewBox="0 0 31 30" fill="none" role="img" aria-label="Vultisig">
      <defs>
        <linearGradient id={gradientId} x1="15.5" y1="0" x2="15.5" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4879FD" />
          <stop offset="1" stopColor="#0D39B1" />
        </linearGradient>
      </defs>
      <circle cx="15.5" cy="15" r="15" fill={`url(#${gradientId})`} />
      <g fill="#fff" transform="translate(6.88 5.9) scale(0.4)">
        {PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}
