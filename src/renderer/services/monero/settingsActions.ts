import { firstValueFrom } from 'rxjs'

import { clientNetwork$ } from '../app/service'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { deriveXmrExportKeys, deriveXmrViewKeys, XmrExportKeys } from './derivation'
import { createLwsConfirmation, LwsConfirmation } from './lwsConfirmation'

/**
 * Actions of the Monero wallet settings which need key material of the unlocked keystore.
 *
 * **Both must only be called after the UI confirmed the keystore password**
 * (`WalletPasswordConfirmationModal`, see `MoneroSettingsPanel`).
 */

const currentPhrase = async (): Promise<{ phrase: string; network: Awaited<ReturnType<typeof getNetwork>> }> => {
  const phrase = getPhrase(keystoreService.keystoreState())
  if (phrase._tag !== 'Some') throw new Error('Wallet is locked')
  return { phrase: phrase.value, network: await getNetwork() }
}

const getNetwork = () => firstValueFrom(clientNetwork$)

/** Confirmation of exactly `url` for the current wallet (creates the proof `getConfirmedLws` verifies) */
export const confirmLwsForCurrentWallet = async (url: string): Promise<LwsConfirmation> => {
  const { phrase, network } = await currentPhrase()
  return createLwsConfirmation(deriveXmrViewKeys(phrase, network), url)
}

/** Private spend + view keys of the current wallet (for the password-gated export) */
export const exportKeysOfCurrentWallet = async (): Promise<XmrExportKeys> => {
  const { phrase, network } = await currentPhrase()
  return deriveXmrExportKeys(phrase, network)
}
