import React, { useMemo } from 'react'

import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { getChainAsset, isThorChain } from '../../../../helpers/chainHelper'
import { AssetIcon } from '../../../uielements/assets/assetIcon'
import { WalletTypeLabel } from '../../../uielements/common'
import { Label } from '../../../uielements/label'
import { InteractType } from './Interact.types'

type Props = {
  children?: React.ReactNode
  interactType: InteractType
  interactTypeChanged: (type: InteractType) => void
  walletType: WalletType
  network: Network
  chain: Chain
}

export const Interact = ({ interactType, interactTypeChanged, network, walletType, chain, children }: Props) => {
  const intl = useIntl()
  const name = isThorChain(chain) ? InteractType.THORName : InteractType.MAYAName
  const tabs: Array<{ type: InteractType; label: string }> = useMemo(
    () => {
      const baseTabs = [
        { type: InteractType.Whitelist, label: intl.formatMessage({ id: 'deposit.interact.actions.whitelist' }) },
        { type: InteractType.Bond, label: intl.formatMessage({ id: 'deposit.interact.actions.bond' }) },
        { type: InteractType.Unbond, label: intl.formatMessage({ id: 'deposit.interact.actions.unbond' }) },
        { type: InteractType.Leave, label: intl.formatMessage({ id: 'deposit.interact.actions.leave' }) },
        { type: InteractType.Custom, label: intl.formatMessage({ id: 'common.custom' }) },
        { type: name, label: intl.formatMessage({ id: `common.${name}` }) }
      ]

      // Add RunePool for THORChain
      if (chain === THORChain) {
        baseTabs.push({
          type: InteractType.RunePool,
          label: intl.formatMessage({ id: 'deposit.interact.actions.runePool' })
        })
      }

      // Add CacaoPool for Mayachain
      if (chain === MAYAChain) {
        baseTabs.push({
          type: InteractType.CacaoPool,
          label: intl.formatMessage({ id: 'deposit.interact.actions.cacaoPool' })
        })
      }

      return baseTabs
    },
    [intl, name, chain] // Add chain to the dependency array
  )
  const asset = getChainAsset(chain)

  return (
    <div className="flex min-h-full w-full max-w-[690px] flex-col p-2.5 sm:p-[35px_50px_150px]">
      <div className="mb-5 flex flex-col items-center justify-center sm:flex-row sm:justify-start">
        <AssetIcon className="mb-10px mr-0 sm:mb-0 sm:mr-4" network={network} asset={asset} size="big" />
        <div>
          <div className="flex items-center justify-center sm:justify-start">
            <Label className="w-auto text-center text-[24px] sm:text-left" textTransform="uppercase">
              {intl.formatMessage({ id: 'deposit.interact.title' })}
            </Label>
            {isLedgerWallet(walletType) && (
              <WalletTypeLabel className="ml-2.5">{intl.formatMessage({ id: 'ledger.title' })}</WalletTypeLabel>
            )}
          </div>
          <Label className="w-auto text-center sm:text-left" color="gray" size="big" textTransform="uppercase">
            {intl.formatMessage({ id: 'deposit.interact.subtitle' }, { chain: chain })}
          </Label>
        </div>
      </div>

      <ul className="hidden items-center gap-2 border-b border-gray0 dark:border-gray0d md:flex">
        {tabs.map(({ type, label }) => {
          const isActive = type === interactType
          return (
            <li key={type}>
              <button
                type="button"
                onClick={() => interactTypeChanged(type)}
                className={clsx(
                  'inline-flex items-center rounded-t-md border-b-2 px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'border-turquoise text-turquoise'
                    : 'border-transparent text-text0 hover:bg-gray0/50 hover:text-turquoise dark:text-text0d dark:hover:bg-gray0d/50'
                )}>
                {label}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="md:hidden">
        <Menu as="div" className="relative inline-block w-full">
          <MenuButton
            className={clsx(
              'flex w-full items-center justify-between rounded-md border border-gray0 px-3 py-2 text-sm dark:border-gray0d',
              'bg-bg0 dark:bg-bg0d'
            )}>
            <Label size="big">{tabs.find((t) => t.type === interactType)?.label ?? tabs[0]?.label}</Label>
            <ChevronDownIcon className="h-4 w-4 text-text0 dark:text-text0d" />
          </MenuButton>

          <Transition
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95">
            <MenuItems
              anchor="bottom start"
              className={clsx(
                'absolute z-10 mt-1 w-[--button-width] min-w-[12rem] rounded-md shadow-lg',
                'border border-gray0 dark:border-gray0d',
                'bg-bg0 focus:outline-none dark:bg-bg0d'
              )}>
              <div className="py-1">
                {tabs.map(({ type, label }) => {
                  const isActive = type === interactType
                  return (
                    <MenuItem key={type}>
                      {({ focus }) => (
                        <button
                          type="button"
                          onClick={() => interactTypeChanged(type)}
                          className={clsx(
                            'block w-full px-3 py-2 text-left text-sm',
                            focus ? 'bg-turquoise/10 text-turquoise' : 'text-text0 dark:text-text0d',
                            isActive && 'font-bold !text-turquoise'
                          )}>
                          {label}
                        </button>
                      )}
                    </MenuItem>
                  )
                })}
              </div>
            </MenuItems>
          </Transition>
        </Menu>
      </div>

      <div className="mt-4">{children}</div>
    </div>
  )
}
