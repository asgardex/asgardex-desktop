/* eslint-disable @typescript-eslint/no-explicit-any */
import { UseQueryOptions } from '@tanstack/react-query'

type UseQueryGenericOptions = Partial<
  Pick<
    UseQueryOptions<any>,
    | 'refetchOnMount'
    | 'refetchOnWindowFocus'
    | 'refetchOnReconnect'
    | 'staleTime'
    | 'refetchInterval'
    | 'refetchIntervalInBackground'
    | 'meta'
  >
>

const noRefetchQueryOptions: UseQueryGenericOptions = {
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false
}

export const fixedDataQueryOptions: UseQueryGenericOptions = {
  ...noRefetchQueryOptions,
  staleTime: Infinity,
  meta: { disablePersist: true }
}

export const pollingQueryOptions = (interval: number): UseQueryGenericOptions => ({
  refetchInterval: interval,
  refetchIntervalInBackground: true
})
