import { Route } from '../types'

type RedirectUrl = string

export const base: Route<RedirectUrl | void> = {
  template: '/portfolio',
  path(redirectUrl) {
    return redirectUrl ? `${this.template}?redirectUrl=${redirectUrl}` : this.template
  }
}
