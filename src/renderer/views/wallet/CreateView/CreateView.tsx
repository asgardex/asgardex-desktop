import { useIntl } from 'react-intl'

import { PhraseView } from './PhraseView'
import { LayoutlessWrapper } from 'components/LayoutlessWrapper'

export const CreateView = () => {
  const intl = useIntl()

  return (
    <LayoutlessWrapper title={intl.formatMessage({ id: 'wallet.create.title' })}>
      <PhraseView />
    </LayoutlessWrapper>
  )
}
