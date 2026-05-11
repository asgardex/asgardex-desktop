import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { ChainProviderConfig, ProviderId, ProviderEntry } from '../../../shared/providers/types'

type Props = {
  config: ChainProviderConfig
  selectedProviderId: ProviderId
  onSelectProvider: (providerId: ProviderId) => void
}

const BadgeLabel = ({
  badge,
  intl
}: {
  badge?: 'recommended' | 'backup' | 'manual'
  intl: ReturnType<typeof useIntl>
}) => {
  if (!badge) return null
  const labels: Record<string, string> = {
    recommended: intl.formatMessage({ id: 'settings.provider.badge.recommended' }),
    backup: intl.formatMessage({ id: 'settings.provider.badge.backup' }),
    manual: intl.formatMessage({ id: 'settings.provider.badge.manual' })
  }
  return (
    <span
      className={clsx(
        'rounded px-1.5 py-px font-main text-[10px] font-bold tracking-wide uppercase',
        badge === 'recommended'
          ? 'border border-turquoise/30 bg-turquoise/15 text-turquoise'
          : badge === 'backup'
            ? 'border border-warning0/25 bg-warning0/12 text-warning0'
            : 'border border-gray1/25 bg-gray1/12 text-gray2 dark:text-gray2d'
      )}>
      {labels[badge]}
    </span>
  )
}

export const ProviderSelector = ({ config, selectedProviderId, onSelectProvider }: Props): JSX.Element => {
  const intl = useIntl()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectedProvider = useMemo(
    () => config.providers.find((p) => p.id === selectedProviderId),
    [config.providers, selectedProviderId]
  )

  const isCustom = selectedProviderId === 'custom'

  const handleSelect = useCallback(
    (providerId: ProviderId) => {
      onSelectProvider(providerId)
      setIsOpen(false)
    },
    [onSelectProvider]
  )

  return (
    <div ref={containerRef} className="border-b border-gray0 px-4 py-3 dark:border-gray0d">
      {/* Provider chip / trigger */}
      <div className="flex items-center gap-3">
        <span className="font-main text-[14px] text-gray1 uppercase dark:text-gray1d">
          {intl.formatMessage({ id: 'settings.provider.label' })}
        </span>
        <button
          className={clsx(
            'flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors',
            isOpen
              ? 'border-turquoise/50 bg-turquoise/12'
              : 'border-turquoise/25 bg-turquoise/8 hover:border-turquoise/40 hover:bg-turquoise/12'
          )}
          onClick={() => setIsOpen(!isOpen)}>
          <span className="font-main text-[14px] font-semibold text-text0 dark:text-text0d">
            {isCustom ? intl.formatMessage({ id: 'settings.provider.custom' }) : (selectedProvider?.name ?? 'Select')}
          </span>
          {isCustom ? (
            <BadgeLabel badge="manual" intl={intl} />
          ) : (
            selectedProvider && <BadgeLabel badge={selectedProvider.badge} intl={intl} />
          )}
          {!isCustom && selectedProvider && (
            <span className="font-main text-[12px] text-gray2 dark:text-gray2d">{selectedProvider.domain}</span>
          )}
          <ChevronDownIcon
            className={clsx('h-4 w-4 text-gray2 transition-transform dark:text-gray2d', isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="mt-2 overflow-hidden rounded-md border border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d">
          {config.providers.map((provider: ProviderEntry) => (
            <ProviderOption
              key={provider.id}
              provider={provider}
              isSelected={provider.id === selectedProviderId}
              onSelect={() => handleSelect(provider.id)}
              intl={intl}
            />
          ))}
          {/* Custom option */}
          <button
            className={clsx(
              'flex w-full items-center gap-3 border-t border-gray0/50 px-4 py-3 text-left transition-colors dark:border-gray0d/50',
              isCustom ? 'border-l-[3px] border-l-turquoise bg-turquoise/8 pl-[13px]' : 'hover:bg-turquoise/6'
            )}
            onClick={() => handleSelect('custom')}>
            <div
              className={clsx(
                'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                isCustom ? 'border-turquoise' : 'border-gray1 dark:border-gray1d'
              )}>
              {isCustom && <div className="h-2 w-2 rounded-full bg-turquoise" />}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-main text-[14px] font-semibold text-text0 dark:text-text0d">
                  {intl.formatMessage({ id: 'settings.provider.custom' })}
                </span>
                <BadgeLabel badge="manual" intl={intl} />
              </div>
              <span className="font-main text-[12px] text-gray2 dark:text-gray2d">
                {intl.formatMessage({ id: 'settings.provider.custom.description' })}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Managed hint when a preset provider is active */}
      {!isCustom && !isOpen && (
        <p className="mt-2 font-main text-[12px] text-gray1 italic dark:text-gray1d">
          {intl.formatMessage({ id: 'settings.provider.hint' })}
        </p>
      )}
    </div>
  )
}

const ProviderOption = ({
  provider,
  isSelected,
  onSelect,
  intl
}: {
  provider: ProviderEntry
  isSelected: boolean
  onSelect: () => void
  intl: ReturnType<typeof useIntl>
}) => (
  <button
    className={clsx(
      'flex w-full items-center gap-3 border-b border-gray0/50 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-gray0d/50',
      isSelected ? 'border-l-[3px] border-l-turquoise bg-turquoise/8 pl-[13px]' : 'hover:bg-turquoise/6'
    )}
    onClick={onSelect}>
    <div
      className={clsx(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
        isSelected ? 'border-turquoise' : 'border-gray1 dark:border-gray1d'
      )}>
      {isSelected && <div className="h-2 w-2 rounded-full bg-turquoise" />}
    </div>
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-main text-[14px] font-semibold text-text0 dark:text-text0d">{provider.name}</span>
        <BadgeLabel badge={provider.badge} intl={intl} />
      </div>
      <span className="font-main text-[12px] text-gray2 dark:text-gray2d">{provider.description}</span>
      <span className="font-mono text-[12px] text-gray1 dark:text-gray1d">{provider.domain}</span>
    </div>
  </button>
)

export default ProviderSelector
