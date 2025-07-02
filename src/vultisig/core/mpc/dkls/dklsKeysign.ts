import { base64Encode } from '@lib/utils/base64Encode'

import __wbg_init, { Keyshare, SignSession } from '../../../lib/dkls/vs_wasm'
import { deleteRelayMessage } from '../deleteRelayMessage'
import { encodeDERSignature } from '../derSignature'
import { downloadRelayMessage, RelayMessage } from '../downloadRelayMessage'
import { waitForSetupMessage } from '../downloadSetupMessage'
import {
  decodeDecryptMessage,
  encodeEncryptMessage,
} from '../encodingAndEncryption'
import { getMessageHash } from '../getMessageHash'
import { KeysignSignature } from '../keysign/KeysignSignature'
import { markLocalPartyKeysignComplete } from '../keysignComplete'
import { sendRelayMessage } from '../sendRelayMessage'
import { sleep } from '../sleep'
import { uploadSetupMessage } from '../uploadSetupMessage'

export class DKLSKeysign {
  private readonly serverURL: string
  private readonly localPartyId: string
  private readonly sessionId: string
  private readonly hexEncryptionKey: string
  private readonly publicKeyECDSA: string
  private readonly chainPath: string
  private readonly keysignCommittee: string[]
  private readonly isInitiateDevice: boolean
  private isKeysignComplete: boolean = false
  private sequenceNo: number = 0
  private cache: Record<string, string> = {}
  private readonly keyshare: string
  constructor(
    serverURL: string,
    localPartyId: string,
    sessionId: string,
    hexEncryptionKey: string,
    publicKeyECDSA: string,
    chainPath: string,
    keysignCommittee: string[],
    isInitiateDevice: boolean,
    keyshare: string
  ) {
    this.serverURL = serverURL
    this.localPartyId = localPartyId
    this.sessionId = sessionId
    this.hexEncryptionKey = hexEncryptionKey
    this.publicKeyECDSA = publicKeyECDSA
    this.chainPath = chainPath.replaceAll("'", '')
    this.keysignCommittee = keysignCommittee
    this.isInitiateDevice = isInitiateDevice
    this.keyshare = keyshare
  }

  private async processOutbound(session: SignSession, messageId: string) {
    console.log('processOutbound')
    while (true) {
      try {
        const message = session.outputMessage()
        if (message === undefined) {
          if (this.isKeysignComplete) {
            console.log('stop processOutbound')
            return
          } else {
            await sleep(100) // backoff for 100ms
          }
          continue
        }
        console.log('outbound message:', message)
        const messageToSend = await encodeEncryptMessage(
          message.body,
          this.hexEncryptionKey
        )
        message?.receivers.forEach(receiver => {
          // send message to receiver
          sendRelayMessage({
            serverURL: this.serverURL,
            localPartyId: this.localPartyId,
            sessionId: this.sessionId,
            message: messageToSend,
            to: receiver,
            sequenceNo: this.sequenceNo,
            messageHash: getMessageHash(base64Encode(message.body)),
            messageId: messageId,
          })
          this.sequenceNo++
        })
      } catch (error) {
        console.error('processOutbound error:', error)
      }
    }
  }

  private async processInbound(session: SignSession, messageId: string) {
    const start = Date.now()
    while (true) {
      try {
        const downloadMsg = await downloadRelayMessage({
          serverURL: this.serverURL,
          localPartyId: this.localPartyId,
          sessionId: this.sessionId,
          messageId: messageId,
        })
        const parsedMessages: RelayMessage[] = JSON.parse(downloadMsg)
        for (const msg of parsedMessages) {
          const cacheKey = `${msg.session_id}-${msg.from}-${messageId}-${msg.hash}`
          if (this.cache[cacheKey]) {
            continue
          }
          console.log(
            `got message from: ${msg.from},to: ${msg.to},key:${cacheKey}`
          )
          const decryptedMessage = await decodeDecryptMessage(
            msg.body,
            this.hexEncryptionKey
          )
          const isFinish = session.inputMessage(decryptedMessage)
          if (isFinish) {
            this.isKeysignComplete = true
            console.log('keysign complete')
            return true
          }
          this.cache[cacheKey] = ''
          await deleteRelayMessage({
            serverURL: this.serverURL,
            localPartyId: this.localPartyId,
            sessionId: this.sessionId,
            messageHash: msg.hash,
            messageId: messageId,
          })
        }
        const end = Date.now()
        // timeout after 1 minute
        if (end - start > 1000 * 60) {
          console.log('timeout')
          this.isKeysignComplete = true
          return false
        }
      } catch (error) {
        console.error('processInbound error:', error)
      }
    }
  }
  private async KeysignOneMessage(messageToSign: string, attempt: number) {
    console.log(
      'KeysignOneMessage attempt:',
      attempt,
      'message:',
      messageToSign
    )
    const messageHash = getMessageHash(messageToSign)
    console.log(
      'KeysignOneMessage:',
      messageToSign,
      ' message hash:',
      messageHash
    )
    const keyshare = Keyshare.fromBytes(Buffer.from(this.keyshare, 'base64'))
    let setupMessage: Uint8Array
    if (this.isInitiateDevice) {
      setupMessage = SignSession.setup(
        keyshare.keyId(),
        this.chainPath,
        Buffer.from(messageToSign, 'hex'),
        this.keysignCommittee
      )
      const encryptedSetupMessage = await encodeEncryptMessage(
        setupMessage,
        this.hexEncryptionKey
      )
      await uploadSetupMessage({
        serverUrl: this.serverURL,
        sessionId: this.sessionId,
        message: encryptedSetupMessage,
        messageId: messageHash,
      })
      console.log('upload setup message:', setupMessage)
    } else {
      const encodedEncryptedSetupMsg = await waitForSetupMessage({
        serverURL: this.serverURL,
        sessionId: this.sessionId,
        messageId: messageHash,
      })
      setupMessage = await decodeDecryptMessage(
        encodedEncryptedSetupMsg,
        this.hexEncryptionKey
      )
    }
    const signMsgHash = SignSession.setupMessageHash(setupMessage)
    if (signMsgHash === undefined) {
      throw new Error('setup message hash is undefined')
    }
    const hexSignMsgHash = Buffer.from(signMsgHash).toString('hex')
    if (messageToSign != hexSignMsgHash) {
      throw new Error('message hash not match')
    }
    // good to sign
    const session = new SignSession(setupMessage, this.localPartyId, keyshare)
    const outbound = this.processOutbound(session, messageHash)
    const inbound = this.processInbound(session, messageHash)
    const [, inboundResult] = await Promise.all([outbound, inbound])
    if (inboundResult) {
      const signature = session.finish()
      const r = signature.slice(0, 32)
      const s = signature.slice(32, 64)
      const recoveryId = signature[64]
      const derSignature = encodeDERSignature(r, s)
      const keysignSig: KeysignSignature = {
        msg: Buffer.from(messageToSign, 'hex').toString('base64'),
        r: Buffer.from(r).toString('hex'),
        s: Buffer.from(s).toString('hex'),
        recovery_id: recoveryId.toString(16).padStart(2, '0'),
        der_signature: Buffer.from(derSignature).toString('hex'),
      }
      await markLocalPartyKeysignComplete({
        serverURL: this.serverURL,
        sessionId: this.sessionId,
        messageId: messageHash,
        jsonSignature: JSON.stringify(keysignSig),
      })
      return keysignSig
    }
  }
  private async keygienWithRetry(messageToSign: string) {
    for (let i = 0; i < 3; i++) {
      try {
        const result = await this.KeysignOneMessage(messageToSign, i)
        if (result !== undefined) {
          return result
        }
      } catch (error) {
        console.error('dkls keysign error:', error)
      }
    }
  }
  public async startKeysign(messsagesToSign: string[]) {
    await __wbg_init()
    let results: KeysignSignature[] = []
    for (const message of messsagesToSign) {
      const signResult = await this.keygienWithRetry(message)
      if (signResult === undefined) {
        throw new Error('failed to sign message')
      }
      results = [...results, signResult]
    }
    return results
  }
}
