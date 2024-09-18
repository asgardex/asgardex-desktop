import React from 'react'

import { useDex } from '../../hooks/useDex'
import { useNetwork } from '../../hooks/useNetwork'
import { SidebarComponent } from './SidebarComponent'

export type Props = {
  commitHash?: string
  isDev: boolean
  publicIP: string
}

export const Sidebar: React.FC<Props> = (props): JSX.Element => {
  const { commitHash, isDev, publicIP } = props

  const { network } = useNetwork()
  const { dex } = useDex()

  return <SidebarComponent dex={dex} network={network} commitHash={commitHash} isDev={isDev} publicIP={publicIP} />
}
