import { Route } from '../types'

export const base: Route<void> = {
  template: `/vultisig`,
  path() {
    return this.template
  }
}

export const setupVault: Route<void> = {
  template: `${base.template}/create`,
  path() {
    return this.template
  }
}

export const setupFastVault: Route<void> = {
  template: `${base.template}/create/fast`,
  path() {
    return this.template
  }
}

export const waitForServer: Route<void> = {
  template: `${base.template}/wait-for-server`,
  path() {
    return this.template
  }
}

export const fastKeygen: Route<void> = {
  template: `${base.template}/fast-vault-keygen`,
  path() {
    return this.template
  }
}

export const keygenFlow: Route<void> = {
  template: `${base.template}/fast-keygen-flow`,
  path() {
    return this.template
  }
}

export const emailConfirmation: Route<void> = {
  template: `${base.template}/email-confirmation`,
  path() {
    return this.template
  }
}

export const vaultBackup: Route<void> = {
  template: `${base.template}/vault-backup`,
  path() {
    return this.template
  }
}

export const importVault: Route<void> = {
  template: `${base.template}/import-vault`,
  path() {
    return this.template
  }
}

export const vault: Route<void> = {
  template: `${base.template}/vault`,
  path() {
    return this.template
  }
}
