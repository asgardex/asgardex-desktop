import { Chain } from './Chain'

export type ChainEntity<T extends Chain = Chain> = {
  chain: T
}
