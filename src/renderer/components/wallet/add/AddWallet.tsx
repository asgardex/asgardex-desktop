import { useCallback } from 'react'

import { FolderPlusIcon, FolderOpenIcon, LockOpenIcon } from '@heroicons/react/20/solid'
import { useIntl } from 'react-intl'
import { useLocation, useNavigate } from 'react-router-dom'

import * as walletRoutes from '../../../routes/wallet'
import { Button } from '../../uielements/button'
import { Label } from '../../uielements/label'

export type Props = { isLocked?: boolean }

export const AddWallet = ({ isLocked = false }: Props) => {
  const intl = useIntl()
  const navigate = useNavigate()
  const location = useLocation()
  const onButtonClick = useCallback(() => {
    navigate(walletRoutes.base.path(location.pathname))
  }, [location.pathname, navigate])

  const intlLabelId = isLocked ? 'wallet.unlock.instruction' : 'wallet.connect.instruction'
  const intlButtonId = isLocked ? 'wallet.action.unlock' : 'wallet.action.connect'

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-bg0 p-[150px_20px] dark:bg-bg0d">
      {isLocked ? (
        <LockOpenIcon className="mb-0 h-[60px] w-[60px] stroke-gray2 dark:stroke-gray2d" />
      ) : (
        <FolderPlusIcon className="mb-0 h-[60px] w-[60px] stroke-gray2 dark:stroke-gray2d" />
      )}
      <Label className="w-auto!" textTransform="uppercase">
        {intl.formatMessage({ id: intlLabelId })}
      </Label>
      <Button onClick={onButtonClick} round="true">
        {isLocked ? <FolderOpenIcon color="primary" /> : <FolderPlusIcon />}
        {intl.formatMessage({ id: intlButtonId })}
      </Button>
    </div>
  )
}
