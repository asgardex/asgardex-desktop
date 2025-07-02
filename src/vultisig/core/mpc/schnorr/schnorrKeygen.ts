/* eslint-disable no-constant-condition */
import __wbg_init, { KeygenSession, Keyshare, QcSession } from '../../../lib/schnorr/vs_schnorr_wasm'
import { base64Encode } from '../../lib/utils/base64Encode'

import { deleteRelayMessage } from '../deleteRelayMessage'
import { downloadRelayMessage, RelayMessage } from '../downloadRelayMessage'
import { waitForSetupMessage } from '../downloadSetupMessage'
import { decodeDecryptMessage, encodeEncryptMessage } from '../encodingAndEncryption'
import { getKeygenThreshold } from '../getKeygenThreshold'
import { getMessageHash } from '../getMessageHash'
import { KeygenOperation } from '../keygen/KeygenOperation'
import { combineReshareCommittee } from '../reshareCommittee'
import { sendRelayMessage } from '../sendRelayMessage'
import { sleep } from '../sleep'
import { uploadSetupMessage } from '../uploadSetupMessage'

export class Schnorr {
  private readonly keygenOperation: KeygenOperation
  private readonly isInitiateDevice: boolean
  private readonly serverURL: string
  private readonly sessionId: string
  private readonly localPartyId: string
  private readonly keygenCommittee: string[]
  private readonly oldKeygenCommittee: string[]
  private readonly hexEncryptionKey: string
  private isKeygenComplete: boolean = false
  private sequenceNo: number = 0
  private cache: Record<string, string> = {}
  private setupMessage: Uint8Array = new Uint8Array()
  private readonly localUI?: string
  private readonly publicKey?: string
  private readonly chainCode?: string
  constructor(
    keygenOperation: KeygenOperation,
    isInitiateDevice: boolean,
    serverURL: string,
    sessionId: string,
    localPartyId: string,
    keygenCommittee: string[],
    oldKeygenCommittee: string[],
    hexEncryptionKey: string,
    setupMessage: Uint8Array, // DKLS/Schnorr keygen only need to setup message once, thus for EdDSA , we could reuse the setup message from DKLS
    localUI?: string,
    publicKey?: string,
    chainCode?: string
  ) {
    this.keygenOperation = keygenOperation
    this.isInitiateDevice = isInitiateDevice
    this.serverURL = serverURL
    this.sessionId = sessionId
    this.localPartyId = localPartyId
    this.keygenCommittee = keygenCommittee
    this.oldKeygenCommittee = oldKeygenCommittee
    this.hexEncryptionKey = hexEncryptionKey
    this.setupMessage = setupMessage
    this.localUI = localUI?.padEnd(64, '0')
    this.publicKey = publicKey
    this.chainCode = chainCode
  }

  private async processOutbound(session: KeygenSession | QcSession) {
    console.log('processOutbound')
    while (true) {
      try {
        const message = session.outputMessage()
        if (message === undefined) {
          if (this.isKeygenComplete) {
            console.log('stop processOutbound')
            return
          } else {
            await sleep(100) // backoff for 100ms
          }
          continue
        }
        console.log('outbound message:', message)
        const messageToSend = await encodeEncryptMessage(message.body, this.hexEncryptionKey)
        message?.receivers.forEach((receiver) => {
          // send message to receiver
          sendRelayMessage({
            serverURL: this.serverURL,
            localPartyId: this.localPartyId,
            sessionId: this.sessionId,
            message: messageToSend,
            to: receiver,
            sequenceNo: this.sequenceNo,
            messageHash: getMessageHash(base64Encode(message.body))
          })
          this.sequenceNo++
        })
      } catch (error) {
        console.error('processOutbound error:', error)
      }
    }
  }

  private async processInbound(session: KeygenSession | QcSession) {
    const start = Date.now()
    while (true) {
      try {
        const downloadMsg = await downloadRelayMessage({
          serverURL: this.serverURL,
          localPartyId: this.localPartyId,
          sessionId: this.sessionId
        })
        const parsedMessages: RelayMessage[] = JSON.parse(downloadMsg)
        for (const msg of parsedMessages) {
          const cacheKey = `${msg.session_id}-${msg.from}-${msg.hash}`
          if (this.cache[cacheKey]) {
            continue
          }
          console.log(`got message from: ${msg.from},to: ${msg.to},key:${cacheKey}`)
          const decryptedMessage = await decodeDecryptMessage(msg.body, this.hexEncryptionKey)
          const isFinish = session.inputMessage(decryptedMessage)
          if (isFinish) {
            this.isKeygenComplete = true
            console.log('keygen complete')
            return true
          }
          this.cache[cacheKey] = ''
          await deleteRelayMessage({
            serverURL: this.serverURL,
            localPartyId: this.localPartyId,
            sessionId: this.sessionId,
            messageHash: msg.hash
          })
        }
        const end = Date.now()
        // timeout after 1 minute
        if (end - start > 1000 * 60) {
          console.log('timeout')
          this.isKeygenComplete = true
          return false
        }
      } catch (error) {
        console.error('processInbound error:', error)
      }
    }
  }

  private async startKeygen(attempt: number) {
    if (this.setupMessage === undefined || this.setupMessage.length === 0) {
      throw new Error('setup message is empty')
    }
    console.log('startKeygen attempt:', attempt)
    console.log('session id:', this.sessionId)
    this.isKeygenComplete = false
    try {
      let session: KeygenSession
      if ('create' in this.keygenOperation) {
        session = new KeygenSession(this.setupMessage, this.localPartyId)
      } else if ('reshare' in this.keygenOperation && this.keygenOperation.reshare === 'migrate') {
        session = KeygenSession.migrate(
          this.setupMessage,
          this.localPartyId,
          Buffer.from(this.localUI || '', 'hex'),
          Buffer.from(this.publicKey || '', 'hex'),
          Buffer.from(this.chainCode || '', 'hex')
        )
      } else {
        throw new Error('invalid keygen type')
      }
      const outbound = this.processOutbound(session)
      const inbound = this.processInbound(session)
      const [, inboundResult] = await Promise.all([outbound, inbound])
      if (inboundResult) {
        const keyShare = session.finish()
        return {
          keyshare: base64Encode(keyShare.toBytes()),
          publicKey: Buffer.from(keyShare.publicKey()).toString('hex'),
          chaincode: Buffer.from(keyShare.rootChainCode()).toString('hex')
        }
      }
      throw new Error('Schnorr keygen failed')
    } catch (error) {
      if (error instanceof Error) {
        console.error('Schnorr keygen error:', error)
        console.error('Schnorr keygen error:', error.stack)
      }
      throw error
    }
  }

  public async startKeygenWithRetry() {
    await __wbg_init()
    for (let i = 0; i < 3; i++) {
      try {
        const result = await this.startKeygen(i)
        return result
      } catch (error) {
        console.error('Schnorr keygen error:', error)
      }
    }
    throw new Error('Schnorr keygen failed')
  }

  private async startReshare(rawSchnorrKeyshare: string | undefined, attempt: number) {
    console.log('startReshare schnorr, attempt:', attempt)
    this.isKeygenComplete = false
    let localKeyshare: Keyshare | null = null
    if (rawSchnorrKeyshare !== undefined && rawSchnorrKeyshare.length > 0) {
      localKeyshare = Keyshare.fromBytes(Buffer.from(rawSchnorrKeyshare, 'base64'))
    }

    try {
      let setupMessage: Uint8Array = new Uint8Array()
      if (this.isInitiateDevice) {
        if (localKeyshare === null) {
          throw new Error('local keyshare is null')
        }
        // keygenCommittee only has new committee members
        const threshold = getKeygenThreshold(this.keygenCommittee.length)
        const { allCommittee, newCommitteeIdx, oldCommitteeIdx } = combineReshareCommittee({
          keygenCommittee: this.keygenCommittee,
          oldKeygenCommittee: this.oldKeygenCommittee
        })
        setupMessage = QcSession.setup(
          localKeyshare,
          allCommittee,
          new Uint8Array(oldCommitteeIdx),
          threshold,
          new Uint8Array(newCommitteeIdx)
        )
        // upload setup message to server
        const encryptedSetupMsg = await encodeEncryptMessage(setupMessage, this.hexEncryptionKey)
        await uploadSetupMessage({
          serverUrl: this.serverURL,
          message: encryptedSetupMsg,
          sessionId: this.sessionId,
          messageId: undefined,
          additionalHeaders: 'eddsa'
        })
        console.log('uploaded setup message successfully')
      } else {
        const encodedEncryptedSetupMsg = await waitForSetupMessage({
          serverURL: this.serverURL,
          sessionId: this.sessionId,
          additionalHeaders: 'eddsa'
        })
        setupMessage = await decodeDecryptMessage(encodedEncryptedSetupMsg, this.hexEncryptionKey)
      }
      const session = new QcSession(setupMessage, this.localPartyId, localKeyshare)

      try {
        const outbound = this.processOutbound(session)
        const inbound = this.processInbound(session)
        const [, inboundResult] = await Promise.all([outbound, inbound])
        if (inboundResult) {
          const finalKeyShare = session.finish()
          if (finalKeyShare === undefined) {
            throw new Error('keyshare is null, schnorr reshare failed')
          }

          return {
            keyshare: base64Encode(finalKeyShare.toBytes()),
            publicKey: Buffer.from(finalKeyShare.publicKey()).toString('hex'),
            chaincode: Buffer.from(finalKeyShare.rootChainCode()).toString('hex')
          }
        }
      } finally {
        session.free()
      }
    } catch (error) {
      console.error('schnorr reshare error:', error)
      throw error
    }
  }

  public async startReshareWithRetry(keyshare: string | undefined) {
    await __wbg_init()
    for (let i = 0; i < 3; i++) {
      try {
        const result = await this.startReshare(keyshare, i)
        if (result !== undefined) {
          return result
        }
      } catch (error) {
        console.error('schnorr reshare error:', error)
      }
    }
    throw new Error('schnorr reshare failed')
  }
}
