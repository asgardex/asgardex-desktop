import { useIntl } from 'react-intl'

import { RUNEBOND_URL } from '../../../services/runebond'
import { BaseButton } from '../../uielements/button'

const Step = ({ index, title, description }: { index: number; title: React.ReactNode; description: string }) => (
  <div className="flex items-start gap-4">
    <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-turquoise/20 font-main-semi-bold text-[14px] text-turquoise">
      {index}
    </div>
    <div className="flex flex-col">
      <span className="font-main-semi-bold text-[16px] text-text0 dark:text-text0d">{title}</span>
      <span className="font-main text-[14px] text-gray2 dark:text-gray2d">{description}</span>
    </div>
  </div>
)

export const HowBondingWorks = () => {
  const intl = useIntl()

  // render "runebond.com" inside the (translated) step title as external link
  const [step1Prefix, step1Suffix = ''] = intl
    .formatMessage({ id: 'bonds.provider.empty.step1.title' })
    .split('runebond.com')

  return (
    <div className="flex w-full flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.provider.empty.howTitle' })}
      </span>
      {/* the copy keeps a reading width while the card spans the page */}
      <p className="mt-4 mb-6 max-w-[720px] font-main text-[16px] text-text0 dark:text-text0d">
        {intl.formatMessage({ id: 'bonds.provider.empty.howIntro' })}
      </p>
      <div className="flex max-w-[720px] flex-col gap-5">
        <Step
          index={1}
          title={
            <>
              {step1Prefix}
              <BaseButton
                className="!inline !p-0 font-main-semi-bold text-[16px] text-turquoise"
                onClick={() => window.apiUrl.openExternal(RUNEBOND_URL)}>
                runebond.com
              </BaseButton>
              {step1Suffix}
            </>
          }
          description={intl.formatMessage({ id: 'bonds.provider.empty.step1.desc' })}
        />
        <Step
          index={2}
          title={intl.formatMessage({ id: 'bonds.provider.empty.step2.title' })}
          description={intl.formatMessage({ id: 'bonds.provider.empty.step2.desc' })}
        />
        <Step
          index={3}
          title={intl.formatMessage({ id: 'bonds.provider.empty.step3.title' })}
          description={intl.formatMessage({ id: 'bonds.provider.empty.step3.desc' })}
        />
      </div>
    </div>
  )
}
