import React from 'react'

import { SyncOutlined } from '@ant-design/icons'
import * as RD from '@devexperts/remote-data-ts'
import * as FP from 'fp-ts/function'
import { useIntl } from 'react-intl'

import { BorderButton } from '../../components/uielements/button'
import * as Styled from './AppView.styles'

interface ErrorAlertProps {
  apiEndpoint: RD.RemoteData<Error, unknown>
  reloadHandler: () => void
}

const MidgardErrorAlert: React.FC<ErrorAlertProps> = ({ apiEndpoint, reloadHandler }) => {
  const intl = useIntl()
  const renderContent = FP.pipe(
    apiEndpoint,
    RD.fold(
      () => <></>,
      () => <></>,
      (e) => (
        <Styled.Alert
          type="error"
          message={intl.formatMessage({ id: 'midgard.error.endpoint.title' })}
          description={e?.message ?? e.toString()}
          action={
            <BorderButton onClick={reloadHandler} color="error" size="medium">
              <SyncOutlined className="mr-10px" />
              {intl.formatMessage({ id: 'common.reload' })}
            </BorderButton>
          }
        />
      ),
      () => <></>
    )
  )

  return <>{renderContent}</>
}

export default MidgardErrorAlert
