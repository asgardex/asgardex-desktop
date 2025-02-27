import { useMemo } from 'react'

import ReactECharts from 'echarts-for-react'

import { useTheme } from '../../../hooks/useTheme'
import { ChartColors } from './utils'

export type ChartProps = {
  chartData: {
    name: string
    value: number
  }[]
  isLegendHidden?: boolean
  showLabelLine?: boolean
}

export const PieChart = ({ isLegendHidden = false, showLabelLine = false, chartData }: ChartProps) => {
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
          valueFormatter: (value: number) =>
            new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value),
          textStyle: {
            color: textColor
          }
        },
        legend: isLegendHidden
          ? { show: false }
          : {
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
            bottom: isLegendHidden ? '0%' : '20%',
            type: 'pie',
            radius: isLegendHidden ? ['40%', '70%'] : ['50%', '80%'],
            padAngle: 3,
            minAngle: 5,
            itemStyle: {
              borderRadius: 'full'
            },
            // eslint-disable-next-line no-template-curly-in-string
            label: showLabelLine ? { color: textColor, formatter: '{b}: ${c}' } : { show: false },
            emphasis: showLabelLine ? {} : { label: { show: false } },
            labelLine: showLabelLine
              ? {
                  lineStyle: {
                    color: textColor
                  },
                  smooth: 0.2,
                  length: 10,
                  length2: 40
                }
              : { show: false },
            data: chartData
          }
        ]
      }}
    />
  )
}
