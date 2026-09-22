import { ReactNode } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NodeHistory, NodeHistoryRD } from '../../../services/runebond'
import { InfoIcon } from '../../uielements/info'
import { Spin } from '../../uielements/spin'
import { RunebondUnavailablePanel } from './RunebondUnavailablePanel'

type Props = {
  title: string
  extra?: ReactNode
  historyRD: NodeHistoryRD
  hasData: (history: NodeHistory) => boolean
  children: (history: NodeHistory) => JSX.Element
}

const Centered = ({ children }: { children: ReactNode }) => (
  <div className="mt-4 flex min-h-[220px] flex-1 items-center justify-center">{children}</div>
)

export const NodeHistoryCard = ({ title, extra, historyRD, hasData, children }: Props) => {
  const intl = useIntl()

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <div className="flex min-h-[32px] items-center justify-between">
        <div className="flex items-center gap-2 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {title}
          <InfoIcon tooltip={intl.formatMessage({ id: 'bonds.provider.detail.churnInfo' })} />
        </div>
        {extra}
      </div>
      {FP.pipe(
        historyRD,
        RD.fold(
          () => (
            <Centered>
              <Spin />
            </Centered>
          ),
          () => (
            <Centered>
              <Spin />
            </Centered>
          ),
          () => <RunebondUnavailablePanel className="mt-4 min-h-[220px] flex-1" />,
          (history) =>
            hasData(history) ? (
              children(history)
            ) : (
              <Centered>
                <span className="max-w-[320px] text-center font-main text-[14px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage({ id: 'bonds.provider.detail.noHistoryYet' })}
                </span>
              </Centered>
            )
        )
      )}
    </div>
  )
}
