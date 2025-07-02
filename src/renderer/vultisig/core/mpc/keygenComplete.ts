import { retry } from '../../lib/utils/query/retry'

type SetKeygenCompleteInput = {
  serverURL: string
  sessionId: string
  localPartyId: string
}
export const setKeygenComplete = async ({
  serverURL,
  sessionId,
  localPartyId
}: SetKeygenCompleteInput): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  await fetch(`${serverURL}/complete/${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify([localPartyId])
  })
}

type WaitKeygenCompleteInput = {
  serverURL: string
  sessionId: string
  peers: string[]
}

const verifyKeygenComplete = async ({ serverURL, sessionId, peers }: WaitKeygenCompleteInput) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  const resp = await fetch(`${serverURL}/complete/${sessionId}`, {
    method: 'GET',
    headers
  })
  if (resp.status < 200 || resp.status > 299) {
    throw new Error(`failed to wait for keygen complete, status: ${resp.status}`)
  }
  const completePeers: string[] = JSON.parse(await resp.text())
  // Check whether all items in peers exist in completePeers
  const allPeersComplete = peers.every((peer) => completePeers.includes(peer))
  if (!allPeersComplete) {
    throw new Error('not all parties done keygen')
  }
}

export const waitForKeygenComplete = async ({ serverURL, sessionId, peers }: WaitKeygenCompleteInput) =>
  retry({
    func: () => verifyKeygenComplete({ serverURL, sessionId, peers }),
    attempts: 10,
    delay: 1000
  })
