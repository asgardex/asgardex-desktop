import { useCallback, useMemo } from 'react'

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { WalletType } from '../../../../shared/wallet/types'
import { createScopedLogger } from '../../../helpers/logger'
import { truncateMiddle } from '../../../helpers/stringHelper'

const logger = createScopedLogger('HeaderLock')
import * as walletRoutes from '../../../routes/wallet'
import { KeystoreState, Wallet } from '../../../services/wallet/types'
import { LockIcon, UnlockIcon } from '../../icons'
import { BaseButton } from '../../uielements/button'
import { Tooltip } from '../../uielements/tooltip'

// Phase D → 4F: Props simplified to use unified wallet API from appWalletService
export type Props = {
  keystoreState: KeystoreState
  lockHandler: FP.Lazy<void>
  isLocked: boolean
  // Phase D → 4F: Unified wallet props
  allWallets: Wallet[]
  activeWallet: O.Option<Wallet>
  selectWallet: (wallet: Wallet) => Promise<void>
}

export const HeaderLock = (props: Props): JSX.Element => {
  const {
    keystoreState: _keystoreState, // kept for potential future use
    lockHandler: onPress,
    isLocked,
    // Phase D: Unified wallet props from appWalletService
    allWallets,
    activeWallet: oSelectedWallet,
    selectWallet
  } = props

  const intl = useIntl()
  const navigate = useNavigate()

  const hasWallets = allWallets.length > 0

  // Phase D → 4F: Selection handler simplified - just calls unified selectWallet
  const handleWalletChange = useCallback(
    (wallet: Wallet) => {
      selectWallet(wallet).catch((error) => {
        // UI handles error display
        logger.error('Failed to select wallet:', error)
      })
    },
    [selectWallet]
  )

  const renderWallets = useMemo(
    () =>
      FP.pipe(
        oSelectedWallet,
        O.fold(
          () => <></>,
          (selectedWallet) => (
            <div className="ease z-10 flex h-[25px] items-center rounded-full bg-bg0 drop-shadow dark:bg-gray0d">
              <div
                className="ease rounded-full border-4 border-bg0 bg-bg0 dark:border-gray0d dark:bg-gray0d"
                onClick={() => onPress()}>
                {isLocked ? (
                  <LockIcon className="h-[28px] w-[28px] cursor-pointer" />
                ) : (
                  <UnlockIcon className="h-[28px] w-[28px] cursor-pointer" />
                )}
              </div>
              <Listbox value={selectedWallet} onChange={handleWalletChange}>
                <div className="relative">
                  <ListboxButton
                    as="div"
                    className={clsx(
                      'group flex cursor-pointer items-center',
                      'font-main text-14 text-text1 dark:text-text1d',
                      'pr-10px pl-5px',
                      'transition duration-300 ease-in-out'
                    )}>
                    {({ open }) => (
                      <>
                        <span className="flex w-full items-center">
                          {truncateMiddle(selectedWallet.name, { start: 3, end: 3, max: 6 })}
                          {selectedWallet.type === WalletType.Vultisig && (
                            <span className="ml-1 rounded-full bg-warning0 px-[5px] py-[1px] text-[9px] leading-tight font-bold text-white">
                              BETA
                            </span>
                          )}
                        </span>
                        <ChevronDownIcon
                          className={clsx('ease h-20px w-20px group-hover:rotate-180', { 'rotate-180': open })}
                        />
                      </>
                    )}
                  </ListboxButton>
                  <ListboxOptions
                    className={clsx(
                      'absolute top-[35px] left-[-100px]',
                      'z-[2000] mt-1 max-h-60 w-[200px]',
                      'overflow-auto bg-bg0 dark:bg-bg0d',
                      'drop-shadow-lg focus:outline-hidden',
                      'rounded-md border border-solid border-gray0 dark:border-gray0d'
                    )}>
                    {FP.pipe(
                      allWallets,
                      A.map((wallet) => {
                        const selected = wallet.type === selectedWallet.type && wallet.id === selectedWallet.id
                        return (
                          <ListboxOption
                            disabled={selected}
                            className={({ selected }) =>
                              clsx(
                                'flex items-center justify-between select-none',
                                'px-20px py-10px',
                                'font-main text-14 text-text1 dark:text-text1d',
                                selected
                                  ? 'cursor-disabled text-gray2 dark:text-gray2d'
                                  : 'cursor-pointer hover:bg-gray0 hover:text-gray2 dark:hover:bg-gray0d dark:hover:text-gray2d'
                              )
                            }
                            key={`${wallet.type}-${wallet.id}`}
                            value={wallet}>
                            <span className="flex items-center">
                              {truncateMiddle(wallet.name, { start: 9, end: 9, max: 20 })}
                              {wallet.type === WalletType.Vultisig && (
                                <>
                                  <span className="text-10 ml-1 text-turquoise">(V)</span>
                                  <span className="ml-1 rounded-full bg-warning0 px-[5px] py-[1px] text-[9px] leading-tight font-bold text-white">
                                    BETA
                                  </span>
                                </>
                              )}
                            </span>
                            {selected && <CheckIcon className="h-20px w-20px text-turquoise" />}
                          </ListboxOption>
                        )
                      })
                    )}
                  </ListboxOptions>
                </div>
              </Listbox>
            </div>
          )
        )
      ),
    [handleWalletChange, isLocked, oSelectedWallet, onPress, allWallets]
  )

  const renderAddWallet = useMemo(
    () => (
      <Tooltip title={intl.formatMessage({ id: 'wallet.add.label' })}>
        <BaseButton className="!p-0 text-warning0" onClick={() => navigate(walletRoutes.noWallet.path())}>
          <PlusCircleIcon className="ml-5px h-[28px] w-[28px]" />
        </BaseButton>
      </Tooltip>
    ),
    [intl, navigate]
  )

  return <div className="flex justify-center">{hasWallets ? renderWallets : renderAddWallet}</div>
}
