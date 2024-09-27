import React, { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import clsx from 'clsx'
import * as FP from 'fp-ts/function'
import { useIntl } from 'react-intl'

import { CheckMayanodeNodeUrlHandler, CheckMayanodeRpcUrlHandler } from '../../services/mayachain/types'
import { CheckMidgardUrlHandler, MidgardUrlRD } from '../../services/midgard/types'
import {
  CheckMidgardUrlHandler as CheckMidgardMayaUrlHandler,
  MidgardUrlRD as MidgardMayaUrlRD
} from '../../services/midgard/types'
import { CheckThornodeNodeUrlHandler, CheckThornodeRpcUrlHandler } from '../../services/thorchain/types'
import { TextButton } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import EditableUrl from './EditableUrl'

export type Props = {
  isPrivate: boolean
  midgardUrl: MidgardUrlRD
  midgardMayaUrl: MidgardMayaUrlRD
  thornodeRpcUrl: string
  mayanodeRpcUrl: string
  thornodeNodeUrl: string
  mayanodeNodeUrl: string
  togglePrivate: (isPrivate: boolean) => void
  onChangeMidgardUrl: (url: string) => void
  onChangeMidgardMayaUrl: (url: string) => void
  checkMidgardUrl$: CheckMidgardUrlHandler
  checkMidgardMayaUrl$: CheckMidgardMayaUrlHandler
  checkThornodeNodeUrl$: CheckThornodeNodeUrlHandler
  checkMayanodeNodeUrl$: CheckMayanodeNodeUrlHandler
  onChangeThornodeNodeUrl: (url: string) => void
  onChangeMayanodeNodeUrl: (url: string) => void
  checkThornodeRpcUrl$: CheckThornodeRpcUrlHandler
  checkMayanodeRpcUrl$: CheckMayanodeRpcUrlHandler
  onChangeThornodeRpcUrl: (url: string) => void
  onChangeMayanodeRpcUrl: (url: string) => void
}

type SubSectionProps = {
  title: string
  children?: React.ReactNode
  className?: string
}

const expertModeDefault: Record<string, boolean> = {
  thorchain: true,
  mayachain: true
}

const SubSection: React.FC<SubSectionProps> = ({ title, className, children }) => (
  <div
    className={clsx(
      'flex w-full items-center justify-between px-4',
      'border-solid border-gray0 last:mb-3 last:border-none dark:border-gray0d',
      className
    )}>
    <h2 className="mb-5px font-main text-[14px] uppercase text-gray1 dark:text-gray1d">{title}</h2>
    <div className="flex flex-col">{children}</div>
  </div>
)

const Section = ({
  title,
  toggleHandler,
  children
}: {
  title: string
  toggleHandler?: React.ReactNode
  children?: React.ReactNode
}) => (
  <div className="flex flex-col border-t border-solid border-gray0 first:border-none dark:border-gray0d">
    <div className="flex items-center justify-between">
      <h2 className="mb-5px px-4 py-3 font-main text-[18px] uppercase text-text2 dark:text-text2d">{title}</h2>
      {toggleHandler}
    </div>
    {children}
  </div>
)

export const AppExpertMode: React.FC<Props> = (props): JSX.Element => {
  const {
    togglePrivate,
    isPrivate,
    midgardUrl: midgardUrlRD,
    midgardMayaUrl: midgardMayaUrlRD,
    onChangeMidgardUrl,
    onChangeMidgardMayaUrl,
    checkMidgardUrl$,
    checkMidgardMayaUrl$,
    onChangeThornodeNodeUrl,
    onChangeMayanodeNodeUrl,
    checkThornodeNodeUrl$,
    checkMayanodeNodeUrl$,
    checkThornodeRpcUrl$,
    checkMayanodeRpcUrl$,
    onChangeThornodeRpcUrl,
    onChangeMayanodeRpcUrl,
    thornodeRpcUrl,
    thornodeNodeUrl,
    mayanodeNodeUrl,
    mayanodeRpcUrl
  } = props

  const intl = useIntl()

  const midgardUrl = useMemo(() => {
    const empty = () => ''
    return FP.pipe(midgardUrlRD, RD.fold(empty, empty, empty, FP.identity))
  }, [midgardUrlRD])
  const midgardMayaUrl = useMemo(() => {
    const empty = () => ''
    return FP.pipe(midgardMayaUrlRD, RD.fold(empty, empty, empty, FP.identity))
  }, [midgardMayaUrlRD])

  const [advancedActive, setAdvancedActive] = useState<Record<string, boolean>>(() => {
    const cachedValue = localStorage.getItem('advanceActive')
    return cachedValue ? JSON.parse(cachedValue) : expertModeDefault
  })
  useEffect(() => {
    localStorage.setItem('openPanelKeys', JSON.stringify(advancedActive))
  }, [advancedActive])

  return (
    <div className="flex flex-col">
      <Section
        title="Thorchain URLs"
        toggleHandler={
          <div className="flex items-center justify-end px-4 py-6">
            <TextButton
              className={`mb-0 !py-0 !pl-0 !pr-10px font-main !text-14 uppercase text-text0 dark:text-text0d ${
                advancedActive ? 'opacity-100' : 'opacity-60'
              }`}
              onClick={() => setAdvancedActive((prev) => ({ ...prev, thorchain: !prev.thorchain }))}>
              {intl.formatMessage({ id: 'common.advanced' })}
            </TextButton>
            <SwitchButton
              active={advancedActive.thorchain}
              onChange={(active) => setAdvancedActive({ ...advancedActive, thorchain: active })}></SwitchButton>
            <TextButton
              className={`mb-0 pr-10px font-main !text-14 uppercase text-text0 dark:text-text0d ${
                isPrivate ? 'opacity-100' : 'opacity-60'
              }`}>
              {intl.formatMessage({ id: 'common.privateData' })}
            </TextButton>
            <SwitchButton active={isPrivate} onChange={togglePrivate}></SwitchButton>
          </div>
        }>
        <div
          className={clsx(
            'flex-col transition-all duration-300 ease-in-out',
            advancedActive.thorchain ? 'flex' : 'hidden'
          )}>
          <SubSection title="Midgard">
            <EditableUrl
              className="w-full xl:w-3/4"
              url={midgardUrl}
              onChange={onChangeMidgardUrl}
              loading={RD.isPending(midgardUrlRD)}
              checkUrl$={checkMidgardUrl$}
              successMsg={intl.formatMessage({ id: 'midgard.url.valid' })}
            />
          </SubSection>
          <SubSection title="THORNode API">
            <EditableUrl
              className="w-full xl:w-3/4"
              url={thornodeNodeUrl}
              onChange={onChangeThornodeNodeUrl}
              checkUrl$={checkThornodeNodeUrl$}
              successMsg={intl.formatMessage({ id: 'setting.thornode.node.valid' })}
            />
          </SubSection>
          <SubSection title="THORNode RPC">
            <EditableUrl
              className="w-full xl:w-3/4"
              url={thornodeRpcUrl}
              onChange={onChangeThornodeRpcUrl}
              checkUrl$={checkThornodeRpcUrl$}
              successMsg={intl.formatMessage({ id: 'setting.thornode.rpc.valid' })}
            />
          </SubSection>
        </div>
      </Section>
      <Section
        title="Mayachain URLs"
        toggleHandler={
          <div className="flex items-center justify-end px-4 py-6">
            <TextButton
              className={`mb-0 !py-0 !pl-0 !pr-10px font-main !text-14 uppercase text-text0 dark:text-text0d ${
                advancedActive ? 'opacity-100' : 'opacity-60'
              }`}
              onClick={() => setAdvancedActive((prev) => ({ ...prev, mayachain: !prev.mayachain }))}>
              {intl.formatMessage({ id: 'common.advanced' })}
            </TextButton>
            <SwitchButton
              active={advancedActive.mayachain}
              onChange={(active) => setAdvancedActive({ ...advancedActive, mayachain: active })}></SwitchButton>
            <TextButton
              className={`mb-0 pr-10px font-main !text-14 uppercase text-text0 dark:text-text0d ${
                isPrivate ? 'opacity-100' : 'opacity-60'
              }`}>
              {intl.formatMessage({ id: 'common.privateData' })}
            </TextButton>
            <SwitchButton active={isPrivate} onChange={togglePrivate}></SwitchButton>
          </div>
        }>
        <div
          className={clsx(
            'flex-col transition-all duration-300 ease-in-out',
            advancedActive.mayachain ? 'flex' : 'hidden'
          )}>
          <SubSection title="Midgard Mayachain">
            <EditableUrl
              className="w-full xl:w-3/4"
              url={midgardMayaUrl}
              onChange={onChangeMidgardMayaUrl}
              loading={RD.isPending(midgardMayaUrlRD)}
              checkUrl$={checkMidgardMayaUrl$}
              successMsg={intl.formatMessage({ id: 'midgard.url.valid' })}
            />
          </SubSection>
          <SubSection title="MayaNode API">
            <EditableUrl
              className="w-full xl:w-3/4"
              url={mayanodeNodeUrl}
              onChange={onChangeMayanodeNodeUrl}
              checkUrl$={checkMayanodeNodeUrl$}
              successMsg={intl.formatMessage({ id: 'setting.mayanode.node.valid' })}
            />
          </SubSection>
          <SubSection title="MAYANode RPC">
            <EditableUrl
              className="w-full xl:w-3/4"
              url={mayanodeRpcUrl}
              onChange={onChangeMayanodeRpcUrl}
              checkUrl$={checkMayanodeRpcUrl$}
              successMsg={intl.formatMessage({ id: 'setting.mayanode.rpc.valid' })}
            />
          </SubSection>
        </div>
      </Section>
    </div>
  )
}
