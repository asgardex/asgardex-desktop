import { useMemo } from 'react'

import ReactECharts from 'echarts-for-react'

import { useTheme } from '../../../hooks/useTheme'
import { ChartColors } from './utils'

export type ChartProps = {
  chartData: {
    name: string
    value: number
  }[]
}

export const PieChart = ({ chartData }: ChartProps) => {
  const { isLight: isLightTheme } = useTheme()

  // text-text2 dark:text-text2d
  const textColor = useMemo(() => (isLightTheme ? 'rgb(97, 107, 117)' : 'rgb(209, 213, 218)'), [isLightTheme])

  return (
    <ReactECharts
      className="w-full"
      option={{
        tooltip: {
          trigger: 'item',
          backgroundColor: isLightTheme ? '#fff' : '#101921',
          valueFormatter: (value: number) => '$' + value.toFixed(2),
          textStyle: {
            color: textColor
          }
        },
        legend: {
          type: 'scroll',
          bottom: '0%',
          itemWidth: 20,
          itemHeight: 12,
          pageIconColor: textColor,
          pageTextStyle: {
            color: textColor
          },
          textStyle: {
            color: textColor,
            fontWeight: 'lighter'
          }
        },
        color: ChartColors,
        series: [
          {
            top: '0%',
            bottom: '20%',
            type: 'pie',
            radius: ['50%', '80%'],
            avoidLabelOverlap: false,
            padAngle: 3,
            minAngle: 5,
            itemStyle: {
              borderRadius: 'full'
            },
            label: {
              show: false
            },
            emphasis: {
              label: { show: false }
            },
            labelLine: {
              show: false
            },
            data: chartData
          }
        ]
      }}
    />
  )
}
