import { SwapMessages } from '../types'

const swap: SwapMessages = {
  'swap.state.pending': 'Swappen',
  'swap.state.error': 'Fehler beim Swap',
  'swap.state.success': 'Erfolgreich getauscht',
  'swap.input': 'Eingabe',
  'swap.output': 'Ausgabe',
  'swap.info.max.balance': 'Gesamtguthaben ({balance})',
  'swap.info.max.balanceMinusFee': 'Gesamtguthaben ({balance}) minus voraussichtliche Swapgebühr ({fee})',
  'swap.slip.title': 'Slip',
  'swap.slip.tolerance': 'Slippage-Toleranz',
  'swap.slip.tolerance.info':
    'Je höher die Prozentangabe, desto höher akzeptierst Du ein Slippage. Mehr Slippage bedeutet zugleich ein größerer Spielraum zur Abdeckung der geschätzten Gebühren, um fehlgeschlagene Swaps zu vermeiden.',
  'swap.slip.tolerance.ledger-disabled.info':
    'Slippage-Toleranz ist deaktiviert aufgrund technischer Probleme mit Ledger.',
  'swap.streaming.title': 'Streamingstatus',
  'swap.streaming.interval': 'Intervall',
  'swap.streaming.interval.info': 'Intervall zwischen Swaps, 10 Blöcke entsprechen einem Intervall von 1 Minute',
  'swap.streaming.quantity': 'Menge',
  'swap.streaming.quantity.info': 'Die Anzahl der Mini-Swaps, die insgesamt pro Intervall durchgeführt werden',
  'swap.errors.amount.balanceShouldCoverChainFee':
    'Transaktionsgebühr in Höhe von {fee} ist nicht über Dein Guthaben {balance} gedeckt.',
  'swap.errors.amount.outputShouldCoverChainFee':
    'Auszahlungsgebühr in Höhe von {fee} ist nicht über den zu erwartenden Auszahlungsbetrag (momentan {amount}) gedeckt',
  'swap.errors.amount.thornodeQuoteError': '{error} : Passe den Slip oder den Eingabebetrag an',
  'swap.note.lockedWallet': 'Entsperre Deine Wallet, um zu tauschen',
  'swap.note.nowallet': 'Erstelle oder importiere eine Wallet, um zu Swappen',
  'swap.errors.asset.missingSourceAsset': 'Ursprungs-Asset nicht vorhanden',
  'swap.errors.asset.missingTargetAsset': 'Ziel-Asset nicht vorhanden',
  'swap.errors.pool.notAvailable': 'Pool nicht verfügbar {pool}',
  'swap.min.amount.info':
    'Erforderlicher Mindestwert für einen Swap, um die Gebühren der Ein- und Auszahlungstransaktionen zu decken.',
  'swap.min.result.info':
    'Dein Swap ist mit diesem Mindestwert basierend auf der ausgewählten {tolerance}% Slippage-Toleranz abgesichert. Falls eine Preisänderung vor der Transaktions-Bestätigung mehr als {tolerance}% zu Deinem Nachteil beträgt, wird Deine Swap-Transaktion zurücküberwiesen.',
  'swap.min.result.protected': 'Gesichertes Swap-Ergebnis'
}

export default swap
