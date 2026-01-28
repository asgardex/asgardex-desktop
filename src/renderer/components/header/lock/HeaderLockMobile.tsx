import { useMemo } from 'react'

import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { LockIcon, UnlockIcon } from '../../icons'
import { Label } from '../../uielements/label'

export type Props = {
  hasWallet: boolean // Any wallet type (keystore, vultisig)
  isLocked: boolean // Unified lock state from appWalletService
  onPress: FP.Lazy<void>
}

export const HeaderLockMobile = (props: Props): JSX.Element => {
  const { hasWallet, isLocked, onPress } = props

  const intl = useIntl()

  const label = useMemo(() => {
    return intl.formatMessage({
      id: !hasWallet ? 'wallet.add.label' : isLocked ? 'wallet.unlock.label' : 'wallet.lock.label'
    })
  }, [intl, isLocked, hasWallet])

  return (
    <div className="flex w-full items-center justify-between px-6 lg:w-auto">
      <Label size="large" textTransform="uppercase" weight="bold">
        {label}
      </Label>
      <div onClick={() => onPress()}>
        {isLocked ? <LockIcon className="h-[28px] w-[28px]" /> : <UnlockIcon className="h-[28px] w-[28px]" />}
      </div>
    </div>
  )
}
