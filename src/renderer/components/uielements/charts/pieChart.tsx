import { useCallback, useMemo, useRef, useState } from 'react'

import { hiddenString } from '../../../helpers/stringHelper'
import { useTheme } from '../../../hooks/useTheme'
import { ChartColors } from './utils'

type ChartProps = {
  chartData: {
    name: string
    value: number
  }[]
  isPrivate?: boolean
  isLegendHidden?: boolean
  showLabelLine?: boolean
}

type SliceData = {
  startAngle: number
  endAngle: number
  midAngle: number
  color: string
  name: string
  value: number
  path: string
}

const DEG2RAD = Math.PI / 180
const MIN_ANGLE = 5 * DEG2RAD
const PAD_ANGLE = 3 * DEG2RAD
const CX = 100
const CY = 100

const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle)
})

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const buildSlices = (data: { name: string; value: number }[], outerR: number, innerR: number): SliceData[] => {
  // Normalize: treat non-finite / non-positive values as 0
  const normalized = data.map((d) => ({
    ...d,
    value: Number.isFinite(d.value) && d.value > 0 ? d.value : 0
  }))
  const n = normalized.length
  if (n === 0) return []

  const total = normalized.reduce((s, d) => s + d.value, 0)
  if (total === 0) return []

  // Filter to only positive entries for geometry
  const positiveCount = normalized.filter((d) => d.value > 0).length

  // Single positive item: full donut ring (two semicircular arcs to avoid SVG limitation)
  if (positiveCount === 1) {
    const idx = normalized.findIndex((d) => d.value > 0)
    const d = normalized[idx]
    const t = polar(CX, CY, outerR, -Math.PI / 2)
    const b = polar(CX, CY, outerR, Math.PI / 2)
    const ti = polar(CX, CY, innerR, -Math.PI / 2)
    const bi = polar(CX, CY, innerR, Math.PI / 2)
    return [
      {
        startAngle: -Math.PI / 2,
        endAngle: (3 * Math.PI) / 2,
        midAngle: Math.PI / 2,
        color: ChartColors[idx % ChartColors.length],
        name: d.name,
        value: d.value,
        path: [
          `M${t.x},${t.y}`,
          `A${outerR},${outerR} 0 1 1 ${b.x},${b.y}`,
          `A${outerR},${outerR} 0 1 1 ${t.x},${t.y}`,
          `L${ti.x},${ti.y}`,
          `A${innerR},${innerR} 0 1 0 ${bi.x},${bi.y}`,
          `A${innerR},${innerR} 0 1 0 ${ti.x},${ti.y}`,
          'Z'
        ].join(' ')
      }
    ]
  }

  // Calculate proportional angles with total padding removed
  const available = Math.max(2 * Math.PI - PAD_ANGLE * positiveCount, 0)
  // Scale minAngle down if too many slices to fit
  const minAngle = positiveCount > 0 ? Math.min(MIN_ANGLE, available / positiveCount) : 0
  const angles = normalized.map((d) => (d.value > 0 ? (d.value / total) * available : 0))

  // Clamp small slices to minAngle, redistribute deficit from larger slices
  for (let iter = 0; iter < 10; iter++) {
    let deficit = 0
    let shrinkable = 0
    let changed = false
    for (let i = 0; i < n; i++) {
      if (angles[i] > 0 && angles[i] < minAngle) {
        deficit += minAngle - angles[i]
        angles[i] = minAngle
        changed = true
      } else if (angles[i] > minAngle) {
        shrinkable += angles[i]
      }
    }
    if (!changed || shrinkable === 0) break
    for (let i = 0; i < n; i++) {
      if (angles[i] > minAngle) angles[i] -= deficit * (angles[i] / shrinkable)
    }
  }

  // Build slice paths starting from top (−π/2), going clockwise
  let cur = -Math.PI / 2
  return normalized
    .map((d, i) => {
      // Skip zero-value entries
      if (angles[i] <= 0) return null

      const start = cur + PAD_ANGLE / 2
      const end = start + angles[i]
      cur = end + PAD_ANGLE / 2

      const os = polar(CX, CY, outerR, start)
      const oe = polar(CX, CY, outerR, end)
      const ie = polar(CX, CY, innerR, end)
      const is_ = polar(CX, CY, innerR, start)
      const large = angles[i] > Math.PI ? 1 : 0

      return {
        startAngle: start,
        endAngle: end,
        midAngle: (start + end) / 2,
        color: ChartColors[i % ChartColors.length],
        name: d.name,
        value: d.value,
        path: [
          `M${os.x},${os.y}`,
          `A${outerR},${outerR} 0 ${large} 1 ${oe.x},${oe.y}`,
          `L${ie.x},${ie.y}`,
          `A${innerR},${innerR} 0 ${large} 0 ${is_.x},${is_.y}`,
          'Z'
        ].join(' ')
      }
    })
    .filter((s): s is SliceData => s !== null)
}

export const PieChart = ({
  isLegendHidden = false,
  showLabelLine = false,
  isPrivate = false,
  chartData
}: ChartProps) => {
  const { isLight: isLightTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const textColor = useMemo(() => (isLightTheme ? 'rgb(97, 107, 117)' : 'rgb(209, 213, 218)'), [isLightTheme])
  const tooltipBg = isLightTheme ? '#fff' : '#101921'
  const tooltipBorder = isLightTheme ? '#e0e0e0' : '#2a3a4a'

  const innerR = isLegendHidden ? 40 : 50
  const outerR = isLegendHidden ? 70 : 80

  const slices = useMemo(() => buildSlices(chartData, outerR, innerR), [chartData, outerR, innerR])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setMousePos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 14 })
    }
  }, [])

  const viewBox = showLabelLine ? '-80 -20 360 240' : '0 0 200 200'

  return (
    <div ref={containerRef} className="w-full" style={{ position: 'relative' }}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', maxHeight: 280 }}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            role="img"
            tabIndex={0}
            aria-label={`${s.name}: ${isPrivate ? hiddenString : usdFormatter.format(s.value)}`}
            style={{
              opacity: hovered !== null && hovered !== i ? 0.6 : 1,
              transition: 'opacity 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
          />
        ))}

        {showLabelLine &&
          slices.map((s, i) => {
            const outerPt = polar(CX, CY, outerR + 2, s.midAngle)
            const elbow = polar(CX, CY, outerR + 12, s.midAngle)
            const isRight = Math.cos(s.midAngle) >= 0
            const endX = elbow.x + (isRight ? 40 : -40)
            return (
              <g key={`label-${i}`}>
                <polyline
                  points={`${outerPt.x},${outerPt.y} ${elbow.x},${elbow.y} ${endX},${elbow.y}`}
                  fill="none"
                  stroke={textColor}
                  strokeWidth={0.8}
                />
                <text
                  x={endX + (isRight ? 3 : -3)}
                  y={elbow.y}
                  fill={textColor}
                  fontSize={9}
                  textAnchor={isRight ? 'start' : 'end'}
                  dominantBaseline="central">
                  {s.name}: {isPrivate ? hiddenString : usdFormatter.format(s.value)}
                </text>
              </g>
            )
          })}
      </svg>

      {hovered !== null && slices[hovered] && (
        <div
          style={{
            position: 'absolute',
            left: mousePos.x,
            top: mousePos.y,
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: 4,
            padding: '6px 10px',
            pointerEvents: 'none',
            zIndex: 10,
            fontSize: 13,
            color: textColor,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: slices[hovered].color,
              marginRight: 6,
              verticalAlign: 'middle'
            }}
          />
          <span style={{ verticalAlign: 'middle' }}>
            {slices[hovered].name}: {isPrivate ? hiddenString : usdFormatter.format(slices[hovered].value)}
          </span>
        </div>
      )}

      {!isLegendHidden && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '4px 12px',
            padding: '8px 0',
            overflowX: 'auto',
            fontSize: 12,
            color: textColor,
            fontWeight: 300
          }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 12,
                  backgroundColor: s.color,
                  borderRadius: 2,
                  flexShrink: 0
                }}
              />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
