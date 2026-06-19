import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { swapDestinationMatches } from '../../../helpers/memoHelper'
import { hiddenString } from '../../../helpers/stringHelper'

type Props = {
  // THOR/Maya only: address the swap output is paid to, parsed from the signed
  // memo (`=:ASSET:DESTADDR:…`). `None` for memo-less protocols (Chainflip,
  // OneClick), where this section does not render.
  outputDestination: O.Option<Address>
  // Recipient the user entered/selected, sent to the quote endpoint.
  intendedRecipient: O.Option<Address>
  hidePrivateData: boolean
}

/**
 * Surfaces, at signing time, the address a THORChain/MAYAChain swap output will
 * be paid to (taken from the memo that is actually signed), so a redirected
 * destination is human-visible. When the signed destination differs from the
 * recipient the user entered, shows a non-blocking warning. This is a
 * visibility aid, not a hard gate — see `parseSwapMemoDestination` for the
 * aggregator-memo caveat. Only applies to memo-based protocols (THOR/Maya);
 * Chainflip/OneClick use a deposit-address transfer with no output memo.
 */
export const SwapDestinationConfirmation = ({
  outputDestination,
  intendedRecipient,
  hidePrivateData
}: Props): JSX.Element | null => {
  const intl = useIntl()

  return FP.pipe(
    outputDestination,
    O.fold(
      () => null,
      (destination) => {
        const mismatch = FP.pipe(
          intendedRecipient,
          O.map((recipient) => !swapDestinationMatches(destination, recipient)),
          O.getOrElse(() => false)
        )

        return (
          <div className="mb-[14px] w-full rounded-lg border border-solid border-gray0 p-3 dark:border-gray0d">
            <div className="mb-1 font-main text-[12px] text-gray2 uppercase dark:text-gray2d">
              {intl.formatMessage({ id: 'swap.destination.title' })}
            </div>
            <div className="font-main text-[13px] break-all text-text0 normal-case dark:text-text0d">
              {hidePrivateData ? hiddenString : destination}
            </div>
            <div className="mt-1 font-main text-[11px] text-gray1 dark:text-gray1d">
              {intl.formatMessage({ id: 'swap.destination.info' })}
            </div>
            {mismatch && (
              <div
                className={clsx(
                  'mt-2 flex items-start gap-1 rounded-md p-2',
                  'font-main text-[12px] text-warning0 dark:text-warning0d',
                  'bg-warning0/10 dark:bg-warning0d/10'
                )}
                aria-live="polite">
                <ExclamationTriangleIcon className="mt-[1px] h-[14px] w-[14px] shrink-0" />
                <span>
                  {intl.formatMessage(
                    { id: 'swap.destination.mismatch' },
                    {
                      recipient: FP.pipe(
                        intendedRecipient,
                        O.map((r) => (hidePrivateData ? hiddenString : r)),
                        O.getOrElse(() => '')
                      )
                    }
                  )}
                </span>
              </div>
            )}
          </div>
        )
      }
    )
  )
}
