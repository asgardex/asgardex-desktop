import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import ThorChainIcon from '../../assets/svg/logo-thorchain.svg?react'
import { mayaIconT } from '../../components/icons'
import { Label } from '../../components/uielements/label'
import { TransactionItem, ChainflipTransactionItem } from '../../components/uielements/transactionProgress'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'

export const HistoryView = (): JSX.Element => {
  const { transactionTrackingService: thorchainTransactionTrackingService } = useThorchainContext()
  const { transactionTrackingService: mayachainTransactionTrackingService } = useMayachainContext()
  const { transactionTrackingService: chainflipTransactionTrackingService } = useChainflipContext()
  // Get transactions from all services
  const thorTransactionsRD = useObservableState(thorchainTransactionTrackingService.getTransactions$, RD.initial)
  const mayaTransactionsRD = useObservableState(mayachainTransactionTrackingService.getTransactions$, RD.initial)
  const chainflipTransactionsRD = useObservableState(chainflipTransactionTrackingService.getTransactions$, RD.initial)

  // Combine and filter active transactions
  const [activeTxs, completedTxs] = useMemo(() => {
    const thorTransactions = RD.isSuccess(thorTransactionsRD) ? thorTransactionsRD.value : []
    const mayaTransactions = RD.isSuccess(mayaTransactionsRD) ? mayaTransactionsRD.value : []
    const chainflipTransactions = RD.isSuccess(chainflipTransactionsRD) ? chainflipTransactionsRD.value : []

    // Combine all transactions and filter for active ones
    const allTransactions = [
      ...thorTransactions.map((tx) => ({ ...tx, protocol: 'Thorchain' as const })),
      ...mayaTransactions.map((tx) => ({ ...tx, protocol: 'Mayachain' as const })),
      ...chainflipTransactions.map((tx) => ({ ...tx, txHash: tx.depositChannelId, protocol: 'Chainflip' as const }))
    ]

    return [allTransactions.filter((tx) => !tx.isComplete), allTransactions.filter((tx) => tx.isComplete)]
  }, [thorTransactionsRD, mayaTransactionsRD, chainflipTransactionsRD])

  const handleRemoveTransaction = useCallback(
    (id: string, protocol: 'Thorchain' | 'Mayachain' | 'Chainflip') => {
      if (protocol === 'Thorchain') {
        thorchainTransactionTrackingService.removeTransaction(id)
      } else if (protocol === 'Mayachain') {
        mayachainTransactionTrackingService.removeTransaction(id)
      } else if (protocol === 'Chainflip') {
        chainflipTransactionTrackingService.removeTransaction(id)
      }
    },
    [mayachainTransactionTrackingService, thorchainTransactionTrackingService, chainflipTransactionTrackingService]
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
          ) : transaction.protocol === 'Chainflip' ? (
            <div className="w-3 h-3 bg-turquoise rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
          ) : (
            <ThorChainIcon className="w-3 h-3 [&>*:not(:first-child)]:fill-text2 [&>*:not(:first-child)]:dark:fill-text2d" />
          )

        // Use appropriate component based on protocol
        return transaction.protocol === 'Chainflip' ? (
          <ChainflipTransactionItem
            key={transaction.id}
            protocol={protocolIcon}
            transaction={transaction}
            onRemove={(id) => handleRemoveTransaction(id, transaction.protocol)}
          />
        ) : (
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
          ) : transaction.protocol === 'Chainflip' ? (
            <div className="w-3 h-3 bg-turquoise rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
          ) : (
            <ThorChainIcon className="w-3 h-3 [&>*:not(:first-child)]:fill-text2 [&>*:not(:first-child)]:dark:fill-text2d" />
          )

        // Use appropriate component based on protocol
        return transaction.protocol === 'Chainflip' ? (
          <ChainflipTransactionItem
            key={transaction.id}
            protocol={protocolIcon}
            transaction={transaction}
            onRemove={(id) => handleRemoveTransaction(id, transaction.protocol)}
          />
        ) : (
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
