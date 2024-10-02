import React from 'react'

import * as FP from 'fp-ts/lib/function'
import { useIntl } from 'react-intl'

import { KeystoreState } from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { FlatButton } from '../uielements/button'

type Props = {
  keystoreState: KeystoreState
  unlockHandler: FP.Lazy<void>
}

export const UnlockWalletSettings: React.FC<Props> = (props): JSX.Element => {
  const { keystoreState, unlockHandler } = props
  const intl = useIntl()

  return (
    <div className="flex items-center justify-center bg-bg0 px-40px py-10px dark:bg-bg0d">
      <FlatButton className="my-30px min-w-[200px] px-30px" onClick={unlockHandler}>
        {!hasImportedKeystore(keystoreState)
          ? intl.formatMessage({ id: 'wallet.add.label' })
          : isLocked(keystoreState) && intl.formatMessage({ id: 'wallet.unlock.label' })}
      </FlatButton>
    </div>
  )
}
