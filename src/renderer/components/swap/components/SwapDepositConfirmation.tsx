import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { hiddenString } from '../../../helpers/stringHelper'

type Props = {
  // Chainflip / OneClick deposit address the source funds are transferred to.
  depositAddress: O.Option<Address>
  depositChannelId: O.Option<string>
  quoteExpiry: Date
  quoteExpired: boolean
  hidePrivateData: boolean
}

/**
 * Pre-sign summary for memo-less deposit protocols (Chainflip, OneClick).
 * Makes the deposit address / channel id / quote expiry visible so a stale
 * quote cannot be confirmed blindly (#1175).
 */
export const SwapDepositConfirmation = ({
  depositAddress,
  depositChannelId,
  quoteExpiry,
  quoteExpired,
  hidePrivateData
}: Props): JSX.Element | null => {
  const intl = useIntl()

  return FP.pipe(
    depositAddress,
    O.fold(
      () => null,
      (address) => (
        <div className="mb-[14px] w-full rounded-lg border border-solid border-gray0 p-3 dark:border-gray0d">
          <div className="mb-1 font-main text-[12px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'swap.deposit.title' })}
          </div>
          <div className="font-main text-[13px] break-all text-text0 normal-case dark:text-text0d">
            {hidePrivateData ? hiddenString : address}
          </div>
          <div className="mt-1 font-main text-[11px] text-gray1 dark:text-gray1d">
            {intl.formatMessage({ id: 'swap.deposit.info' })}
          </div>

          {FP.pipe(
            depositChannelId,
            O.fold(
              () => null,
              (channelId) => (
                <div className="mt-2">
                  <div className="mb-1 font-main text-[12px] text-gray2 uppercase dark:text-gray2d">
                    {intl.formatMessage({ id: 'swap.deposit.channelId' })}
                  </div>
                  <div className="font-main text-[12px] break-all text-text0 normal-case dark:text-text0d">
                    {hidePrivateData ? hiddenString : channelId}
                  </div>
                </div>
              )
            )
          )}

          <div className="mt-2 font-main text-[11px] text-gray1 dark:text-gray1d">
            {intl.formatMessage(
              { id: 'swap.deposit.expiresAt' },
              {
                time: quoteExpiry
                  .toISOString()
                  .replace('T', ' ')
                  .replace(/\.\d+Z$/, ' UTC')
              }
            )}
          </div>

          {quoteExpired && (
            <div
              className={clsx(
                'mt-2 flex items-start gap-1 rounded-md p-2',
                'font-main text-[12px] text-error0 dark:text-error0d',
                'bg-error0/10 dark:bg-error0d/10'
              )}
              aria-live="polite">
              <ExclamationTriangleIcon className="mt-[1px] h-[14px] w-[14px] shrink-0" />
              <span>{intl.formatMessage({ id: 'swap.quote.expired' })}</span>
            </div>
          )}
        </div>
      )
    )
  )
}
