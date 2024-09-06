import { Route } from '../types'

export const base: Route<void> = {
  template: `/pools`,
  path() {
    return this.template
  }
}

export const active: Route<void> = {
  template: `${base.template}/active`,
  path() {
    return this.template
  }
}

export const pending: Route<void> = {
  template: `${base.template}/pending`,
  path() {
    return this.template
  }
}

export const savers: Route<void> = {
  template: `${base.template}/savers`,
  path() {
    return this.template
  }
}

export const lending: Route<void> = {
  template: `${base.template}/lending`,
  path() {
    return this.template
  }
}
