import { useMemo } from 'react'

import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { WalletType } from '../../../../shared/wallet/types'
import { Wallet } from '../../../services/wallet/types'
import { LockIcon, UnlockIcon } from '../../icons'
import { Label } from '../../uielements/label'

export type Props = {
  hasWallet: boolean // Any wallet type (keystore, vultisig)
  isLocked: boolean // Unified lock state from appWalletService
  onPress: FP.Lazy<void>
  activeWallet: O.Option<Wallet>
}

export const HeaderLockMobile = (props: Props): JSX.Element => {
  const { hasWallet, isLocked, onPress, activeWallet } = props

  const intl = useIntl()

  const label = useMemo(() => {
    return intl.formatMessage({
      id: !hasWallet ? 'wallet.add.label' : isLocked ? 'wallet.unlock.label' : 'wallet.lock.label'
    })
  }, [intl, isLocked, hasWallet])

  const isVultisig = FP.pipe(
    activeWallet,
    O.map((w) => w.type === WalletType.Vultisig),
    O.getOrElse(() => false)
  )

  const walletName = FP.pipe(
    activeWallet,
    O.map((w) => w.name),
    O.toUndefined
  )

  return (
    <div className="flex w-full items-center justify-between px-6 lg:w-auto">
      <div className="flex items-center gap-2">
        <Label size="large" textTransform="uppercase" weight="bold">
          {label}
        </Label>
        {isVultisig && walletName && (
          <span className="flex items-center gap-1 text-sm text-turquoise">
            {walletName}
            <span className="rounded-full bg-warning0 px-[5px] py-[1px] text-[9px] leading-tight font-bold text-white">
              BETA
            </span>
          </span>
        )}
      </div>
      <div onClick={() => onPress()}>
        {isLocked ? <LockIcon className="h-[28px] w-[28px]" /> : <UnlockIcon className="h-[28px] w-[28px]" />}
      </div>
    </div>
  )
}
