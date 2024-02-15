import * as RD from '@devexperts/remote-data-ts'
import { ComponentMeta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { Locale } from '../../../shared/i18n/types'
import { getMockRDValueFactory, RDStatus, rdStatusOptions } from '../../../shared/mock/rdByStatus'
import { ChangeDexHandler, ChangeNetworkHandler, OnlineStatus } from '../../services/app/types'
import { AppSettings as Component } from './AppSettings'

type StoryArgs = {
  onlineStatus: OnlineStatus
  updateDataRD: RDStatus
  checkForUpdates: FP.Lazy<void>
  goToReleasePage: (version: string) => void
  changeLocale: (locale: Locale) => void
  onChangeMidgardUrl: (url: string) => void
  onChangeThornodeNodeUrl: (url: string) => void
  onChangeThornodeRpcUrl: (url: string) => void
  onChangeMayanodeNodeUrl: (url: string) => void
  onChangeMayanodeRpcUrl: (url: string) => void
  changeNetwork: ChangeNetworkHandler
  changeDex: ChangeDexHandler
  togglePrivate: () => void
  isPrivate: boolean
  collapsed: boolean
}

const Template = ({
  changeNetwork,
  changeDex,
  togglePrivate,
  isPrivate,
  updateDataRD,
  checkForUpdates,
  goToReleasePage,
  onChangeMidgardUrl,
  onChangeThornodeRpcUrl,
  onChangeThornodeNodeUrl,
  onChangeMayanodeRpcUrl,
  onChangeMayanodeNodeUrl,
  changeLocale,
  collapsed
}: StoryArgs) => {
  const appUpdateState = getMockRDValueFactory<Error, O.Option<string>>(
    () => O.some('2.0.0'),
    () => Error('Error while checking for updates ')
  )(updateDataRD)

  return (
    <Component
      version={'1.0.0'}
      network={Network.Mainnet}
      changeNetwork={changeNetwork}
      dex="THOR"
      changeDex={changeDex}
      togglePrivate={togglePrivate}
      isPrivate={isPrivate}
      appUpdateState={appUpdateState}
      checkForUpdates={checkForUpdates}
      goToReleasePage={goToReleasePage}
      locale={Locale.EN}
      changeLocale={changeLocale}
      collapsed={collapsed}
      toggleCollapse={() => console.log('toggle')}
      midgardUrl={RD.pending}
      thornodeNodeUrl="thornode-node-url"
      thornodeRpcUrl="thornode-rpc-url"
      mayanodeNodeUrl="mayanode-node-url"
      mayanodeRpcUrl="mayanode-rpc-url"
      onChangeMidgardUrl={onChangeMidgardUrl}
      onChangeThornodeRpcUrl={onChangeThornodeRpcUrl}
      onChangeThornodeNodeUrl={onChangeThornodeNodeUrl}
      onChangeMayanodeRpcUrl={onChangeMayanodeRpcUrl}
      onChangeMayanodeNodeUrl={onChangeMayanodeNodeUrl}
      checkMidgardUrl$={(url, _) => Rx.of(RD.success(url))}
      checkThornodeNodeUrl$={(url, _) => Rx.of(RD.success(url))}
      checkThornodeRpcUrl$={(url, _) => Rx.of(RD.success(url))}
      checkMayanodeNodeUrl$={(url, _) => Rx.of(RD.success(url))}
      checkMayanodeRpcUrl$={(url, _) => Rx.of(RD.success(url))}
    />
  )
}

export const Default = Template.bind({})

const meta: ComponentMeta<typeof Template> = {
  component: Template,
  title: 'Components/AppSettings',
  argTypes: {
    updateDataRD: {
      control: {
        type: 'select',
        options: rdStatusOptions
      }
    },
    changeNetwork: {
      action: 'changeNetwork'
    },
    checkForUpdates: {
      action: 'checkForUpdates'
    },
    goToReleasePage: {
      action: 'goToReleasePage'
    },
    onChangeMidgardUrl: {
      action: 'onChangeMidgardUrl'
    },
    onChangeThornodeNodeUrl: {
      action: 'onChangeThornodeNodeUrl'
    },
    onChangeThornodeRpcUrl: {
      action: 'onChangeThornodeRpcUrl'
    },
    onChangeMayanodeNodeUrl: {
      action: 'onChangeMayanodeNodeUrl'
    },
    onChangeMayanodeRpcUrl: {
      action: 'onChangeMayanodeRpcUrl'
    }
  },
  args: { onlineStatus: OnlineStatus.ON, updateDataRD: 'initial', collapsed: false }
}

export default meta
