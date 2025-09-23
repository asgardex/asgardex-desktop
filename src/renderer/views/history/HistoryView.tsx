import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import ThorChainIcon from '../../assets/svg/logo-thorchain.svg?react'
import { mayaIconT } from '../../components/icons'
import { Label } from '../../components/uielements/label'
import { TransactionItem } from '../../components/uielements/transactionProgress'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'

export const HistoryView = (): JSX.Element => {
  const { transactionTrackingService: thorchainTransactionTrackingService } = useThorchainContext()
  const { transactionTrackingService: mayachainTransactionTrackingService } = useMayachainContext()
  // Get transactions from both services
  const thorTransactionsRD = useObservableState(thorchainTransactionTrackingService.getTransactions$, RD.initial)
  const mayaTransactionsRD = useObservableState(mayachainTransactionTrackingService.getTransactions$, RD.initial)

  // Combine and filter active transactions
  const [activeTxs, completedTxs] = useMemo(() => {
    const thorTransactions = RD.isSuccess(thorTransactionsRD) ? thorTransactionsRD.value : []
    const mayaTransactions = RD.isSuccess(mayaTransactionsRD) ? mayaTransactionsRD.value : []

    // Combine all transactions and filter for active ones
    const allTransactions = [
      ...thorTransactions.map((tx) => ({ ...tx, protocol: 'Thorchain' as const })),
      ...mayaTransactions.map((tx) => ({ ...tx, protocol: 'Mayachain' as const }))
    ]

    return [allTransactions.filter((tx) => !tx.isComplete), allTransactions.filter((tx) => tx.isComplete)]
  }, [thorTransactionsRD, mayaTransactionsRD])

  const handleRemoveTransaction = useCallback(
    (id: string, protocol: 'Thorchain' | 'Mayachain') => {
      if (protocol === 'Thorchain') {
        thorchainTransactionTrackingService.removeTransaction(id)
      } else {
        mayachainTransactionTrackingService.removeTransaction(id)
      }
    },
    [mayachainTransactionTrackingService, thorchainTransactionTrackingService]
  )

  if (activeTxs.length === 0 && completedTxs.length === 0) {
    return (
      <div className="bg-bg0 dark:bg-bg0d p-4 rounded-lg">
        <Label size="big" align="center">
          No transactions found
        </Label>
      </div>
    )
  }

  return (
    <div className="bg-bg0 dark:bg-bg0d p-4 rounded-lg">
      {activeTxs.length ? (
        <Label className="mb-1" size="big">
          In Progress ({activeTxs.length})
        </Label>
      ) : null}
      {activeTxs.map((transaction) => {
        const protocolIcon =
          transaction.protocol === 'Mayachain' ? (
            <img src={mayaIconT} alt="Maya" className="w-3 h-3 rounded-full" />
          ) : (
            <ThorChainIcon className="w-3 h-3 [&>*:not(:first-child)]:fill-text2 [&>*:not(:first-child)]:dark:fill-text2d" />
          )

        return (
          <TransactionItem
            key={transaction.id}
            protocol={protocolIcon}
            transaction={transaction}
            onRemove={(id) => handleRemoveTransaction(id, transaction.protocol)}
          />
        )
      })}
      {completedTxs.length ? (
        <Label className="mt-4 mb-1" size="big">
          Completed ({completedTxs.length})
        </Label>
      ) : null}
      {completedTxs.map((transaction) => {
        const protocolIcon =
          transaction.protocol === 'Mayachain' ? (
            <img src={mayaIconT} alt="Maya" className="w-3 h-3 rounded-full" />
          ) : (
            <ThorChainIcon className="w-3 h-3 [&>*:not(:first-child)]:fill-text2 [&>*:not(:first-child)]:dark:fill-text2d" />
          )

        return (
          <TransactionItem
            key={transaction.id}
            protocol={protocolIcon}
            transaction={transaction}
            onRemove={(id) => handleRemoveTransaction(id, transaction.protocol)}
          />
        )
      })}
    </div>
  )
}
