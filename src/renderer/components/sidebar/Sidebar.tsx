import { useNetwork } from '../../hooks/useNetwork'
import { SidebarComponent } from './SidebarComponent'

type Props = {
  commitHash?: string
  isDev: boolean
}

export const Sidebar = (props: Props): JSX.Element => {
  const { commitHash, isDev } = props

  const { network } = useNetwork()

  return <SidebarComponent network={network} commitHash={commitHash} isDev={isDev} />
}
