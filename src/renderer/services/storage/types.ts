import { option as O } from 'fp-ts'

export type StorageState<T> = O.Option<T>
export type StoragePartialState<T> = O.Option<Partial<T>>
