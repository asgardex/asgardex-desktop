import { order } from '../array/order'

type EntityWithOrder = {
  order: number
}

export const sortEntitiesWithOrder = <T extends EntityWithOrder>(items: T[]) =>
  order(items, ({ order }) => order, 'asc')
