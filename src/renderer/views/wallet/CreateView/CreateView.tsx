import { useIntl } from 'react-intl'

import { LayoutlessWrapper } from '../../../components/LayoutlessWrapper'
import { PhraseView } from './PhraseView'

export const CreateView = () => {
  const intl = useIntl()

  return (
    <LayoutlessWrapper title={intl.formatMessage({ id: 'wallet.create.title' })}>
      <PhraseView />
    </LayoutlessWrapper>
  )
}
