import { useMemo } from 'react'

import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { KeystoreState } from '../../../services/wallet/types'
import * as WU from '../../../services/wallet/util'
import { LockIcon, UnlockIcon } from '../../icons'
import { Label } from '../../uielements/label'

export type Props = {
  keystoreState: KeystoreState
  onPress: FP.Lazy<void>
}

export const HeaderLockMobile = (props: Props): JSX.Element => {
  const { keystoreState, onPress } = props

  const intl = useIntl()

  const isLocked = useMemo(() => WU.isLocked(keystoreState), [keystoreState])

  const label = useMemo(() => {
    const notImported = !WU.hasImportedKeystore(keystoreState)
    return intl.formatMessage({
      id: notImported ? 'wallet.add.label' : isLocked ? 'wallet.unlock.label' : 'wallet.lock.label'
    })
  }, [intl, isLocked, keystoreState])

  return (
    <div className="flex items-center justify-between w-full px-4 lg:w-auto">
      <Label size="large" textTransform="uppercase" weight="bold">
        {label}
      </Label>
      <div onClick={() => onPress()}>
        {isLocked ? <LockIcon className="h-[28px] w-[28px]" /> : <UnlockIcon className="h-[28px] w-[28px]" />}
      </div>
    </div>
  )
}
