import { ReactNode } from 'react'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import { SETTINGS_CARD, SETTINGS_LABEL, SETTINGS_SUBTITLE, SETTINGS_TITLE } from './settingsUi'

export type SettingsSectionProps = {
  title: string
  subtitle?: string
  /** Control shown on the right of the header (dropdown, switch, toggle) */
  action?: ReactNode
  children?: ReactNode
  className?: string
}

export const SettingsSection = ({
  title,
  subtitle,
  action,
  children,
  className
}: SettingsSectionProps): JSX.Element => (
  <section className={clsx(SETTINGS_CARD, className)} data-testid="settings-section">
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className={SETTINGS_TITLE}>{title}</h2>
        {subtitle ? <p className={SETTINGS_SUBTITLE}>{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    {children ? <div className="mt-3">{children}</div> : null}
  </section>
)

export type SettingsSubsectionProps = {
  title: string
  warning?: boolean
  warningTooltip?: string
  children?: ReactNode
  className?: string
}

export const SettingsSubsection = ({
  title,
  warning,
  warningTooltip,
  children,
  className
}: SettingsSubsectionProps): JSX.Element => (
  <div
    className={clsx('flex w-full items-center justify-between gap-3 py-2', className)}
    data-testid="settings-subsection">
    <div className="flex min-w-0 items-center gap-2">
      <h3 className={SETTINGS_LABEL}>{title}</h3>
      {warning ? <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-warning0" title={warningTooltip} /> : null}
    </div>
    <div className="flex min-w-0 flex-1 justify-end">{children}</div>
  </div>
)
