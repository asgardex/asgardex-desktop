import { StarIcon as StarOutlined } from '@heroicons/react/24/outline'
import { StarIcon as StarFilled } from '@heroicons/react/24/solid'
import * as FP from 'fp-ts/function'

import { ErrorView } from '../../components/shared/error'
import { ReloadButton } from '../../components/uielements/button'

export const renderWatchColumn = ({
  data: { watched },
  add,
  remove
}: {
  data: { watched: boolean }
  add: FP.Lazy<void>
  remove: FP.Lazy<void>
}) => (
  <div
    className="flex items-center justify-center w-full h-full"
    onClick={(event) => {
      event.preventDefault()
      event.stopPropagation()
      watched ? remove() : add()
    }}>
    {watched ? (
      <StarFilled className="w-5 h-5 stroke-turquoise fill-turquoise" />
    ) : (
      <StarOutlined className="w-5 h-5 stroke-turquoise" />
    )}
  </div>
)

export const renderTableError = (reloadBtnLabel: string, reloadBtnAction: FP.Lazy<void>) => (error: Error) =>
  (
    <ErrorView
      title={error?.toString() ?? ''}
      extra={<ReloadButton label={reloadBtnLabel} onClick={reloadBtnAction} />}
    />
  )
