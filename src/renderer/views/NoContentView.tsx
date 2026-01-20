import { useCallback } from 'react'

import { Button } from '@headlessui/react'
import { useNavigate } from 'react-router-dom'
import { Label } from '../components/uielements/label'

export const NoContentView = (): JSX.Element => {
  const navigate = useNavigate()

  const clickHandler = useCallback(() => {
    navigate(-1)
  }, [navigate])

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-bg0 p-4 dark:bg-bg0d">
      <Label className="w-auto! text-9xl">404</Label>
      <Button className="rounded-lg bg-turquoise px-4 py-2 text-white" onClick={clickHandler}>
        Back
      </Button>
    </div>
  )
}
