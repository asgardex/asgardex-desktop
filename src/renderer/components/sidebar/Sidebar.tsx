import { useNetwork } from '../../hooks/useNetwork'
import { SidebarComponent } from './SidebarComponent'

export type Props = {
  commitHash?: string
  isDev: boolean
  publicIP: string
}

export const Sidebar = (props: Props): JSX.Element => {
  const { commitHash, isDev, publicIP } = props

  const { network } = useNetwork()

  return <SidebarComponent network={network} commitHash={commitHash} isDev={isDev} publicIP={publicIP} />
}
