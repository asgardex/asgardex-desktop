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
    <div className="flex flex-col items-center space-y-2 bg-bg0 dark:bg-bg0d p-4 rounded-lg">
      <Label className="!w-auto text-9xl">404</Label>
      <Button className="rounded-lg bg-turquoise text-white px-4 py-2" onClick={clickHandler}>
        Back
      </Button>
    </div>
  )
}
