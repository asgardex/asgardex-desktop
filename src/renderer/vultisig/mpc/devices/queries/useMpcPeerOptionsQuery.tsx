import { useQuery } from '@tanstack/react-query'
import { useVultisig } from '../../../../store/vultisig/hooks'
import { pollingQueryOptions } from '../../../lib/ui/query/utils/options'
import { without } from '../../../lib/utils/array/without'
import { withoutDuplicates } from '../../../lib/utils/array/withoutDuplicates'
import { queryUrl } from '../../../lib/utils/query/queryUrl'

export const useMpcPeerOptionsQuery = () => {
  const { sessionId, localPartyId, mpcServerUrl: serverUrl } = useVultisig()

  return useQuery({
    queryKey: ['peerOptions', sessionId, serverUrl],
    queryFn: async () => {
      const response = await queryUrl<string[]>(`${serverUrl}/${sessionId}`)

      if (response.length === 0) {
        throw new Error('No peers found')
      }

      return without(withoutDuplicates(response), localPartyId)
    },
    ...pollingQueryOptions(2000)
  })
}
