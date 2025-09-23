import { Route } from '../types'

type RedirectUrl = string

export const base: Route<RedirectUrl | void> = {
  template: '/txs',
  path(redirectUrl) {
    return redirectUrl ? `${this.template}?redirectUrl=${redirectUrl}` : this.template
  }
}
