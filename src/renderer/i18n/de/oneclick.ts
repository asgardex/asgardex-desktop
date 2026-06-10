import { OneClickMessages } from '../types'

const oneclick: OneClickMessages = {
  'oneclick.status.refunded': 'Erstattet',
  'oneclick.status.refunded.detail': 'Einzahlung wurde erstattet',
  'oneclick.status.failed': 'Fehlgeschlagen',
  'oneclick.status.failed.detail': 'Swap fehlgeschlagen',
  'oneclick.status.pending.detail': 'Warte, bis 1Click die Einzahlung erkennt...',
  'oneclick.status.knownDeposit': 'Einzahlung registriert',
  'oneclick.status.knownDeposit.detail': '1Click hat Deine Einzahlungs-Tx bestätigt',
  'oneclick.status.pendingDeposit': 'Warte auf Bestätigung',
  'oneclick.status.pendingDeposit.detail': 'Warte auf Chain-Bestätigungen...',
  'oneclick.status.incomplete': 'Teileinzahlung',
  'oneclick.status.incomplete.detail': 'Es wurde weniger als der angebotene Betrag empfangen',
  'oneclick.status.processing': 'Routing',
  'oneclick.status.processing.detail': 'Solver führen den Swap aus...',
  'oneclick.status.unknown': 'In Bearbeitung',
  'oneclick.refunded': 'Erstattet',
  'oneclick.failed': 'Fehlgeschlagen',
  'oneclick.completed': 'Abgeschlossen',
  'oneclick.field.amount': 'Betrag:',
  'oneclick.field.time': 'Zeit:',
  'oneclick.field.depositAddress': 'Einzahlung:',
  'oneclick.field.originTx': 'Ursprungs-Tx:',
  'oneclick.field.destinationTx': 'Ziel-Tx:',
  'oneclick.field.received': 'Erhalten:'
}

export default oneclick
