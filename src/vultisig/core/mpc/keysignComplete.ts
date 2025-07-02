type KeysignCompleteInput = {
  serverURL: string
  sessionId: string
  messageId: string
  jsonSignature: string
}
export const markLocalPartyKeysignComplete = async ({
  serverURL,
  sessionId,
  messageId,
  jsonSignature
}: KeysignCompleteInput): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  headers['message_id'] = messageId
  try {
    const resp = await fetch(`${serverURL}/complete/${sessionId}/keysign`, {
      method: 'POST',
      headers,
      body: jsonSignature
    })
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`markLocalPartyKeysignComplete failed with status ${resp.status}`)
    }
  } catch (e) {
    console.error('markLocalPartyKeysignComplete error:', e)
  }
}
