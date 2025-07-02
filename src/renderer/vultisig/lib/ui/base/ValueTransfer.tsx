import { ReactNode, useCallback, useState } from 'react'
import { OnBackProp, OnFinishProp, ValueProp } from '../props'

type ValueTransferProps<T> = {
  from: (props: OnFinishProp<T>) => ReactNode
  to: (props: ValueProp<T> & OnBackProp) => ReactNode
}

export function ValueTransfer<T>({ from, to }: ValueTransferProps<T>) {
  const [value, setValue] = useState<T | undefined>(undefined)

  const onBack = useCallback(() => {
    setValue(undefined)
  }, [setValue])

  if (value === undefined) {
    return <>{from({ onFinish: setValue } as OnFinishProp<T>)}</>
  }

  return <>{to({ value, onBack })}</>
}
