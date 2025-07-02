import { useCallback, useMemo } from 'react'
import { useVultisig } from '../../../../../../store/vultisig/hooks'
import { ChildrenProp } from '../../../../../lib/ui/props'
import { getLastItemOrder } from '../../../../../lib/utils/order/getLastItemOrder'
import { hasServer } from '../../../../../mpc/devices/localPartyId'
import { setKeygenComplete, waitForKeygenComplete } from '../../../../mpc/keygenComplete'

import { MpcLib } from '../../../../mpc/mpcLib'
import { KeygenAction, KeygenActionProvider } from '../state/keygenAction'

export const CreateVaultKeygenActionProvider = ({ children }: ChildrenProp) => {
  //   const vaultName = useKeygenVaultName()
  const isInitiatingDevice = true
  const { localPartyId, sessionId, mpcServerUrl: serverURL, hexEncryptionKey, vaultName } = useVultisig()

  //   const vaultOrders = useVaultOrders()
  const vaultOrders = useMemo(() => [1], [])

  const keygenAction: KeygenAction = useCallback(
    async ({ onStepChange, peers }) => {
      onStepChange('ecdsa')

      const signers = [localPartyId, ...peers]

      const sharedFinalVaultFields = {
        signers,
        localPartyId,
        libType: 'DKLS' as MpcLib,
        isBackedUp: false
      }

      console.log('SIGNERS - ', signers)

      window.vultisig.initDKLS({
        keygenOperation: { create: true },
        isInitiateDevice: isInitiatingDevice,
        serverURL,
        sessionId,
        localPartyId,
        keygenCommittee: signers,
        oldKeygenCommittee: [],
        hexEncryptionKey
      })
      const dklsResult = await window.vultisig.startDKLSKeygenWithRetry()

      console.log('DKLS RESULT - ', dklsResult)

      onStepChange('eddsa')

      window.vultisig.initSchnorr({
        keygenOperation: { create: true },
        isInitiateDevice: isInitiatingDevice,
        serverURL,
        sessionId,
        localPartyId,
        keygenCommittee: signers,
        oldKeygenCommittee: [],
        hexEncryptionKey,
        setupMessage: window.vultisig.getSetupMessage()
      })
      const schnorrResult = await window.vultisig.startSchnorrKeygenWithRetry()

      const publicKeys = {
        ecdsa: dklsResult.publicKey,
        eddsa: schnorrResult.publicKey
      }

      const keyShares = {
        ecdsa: dklsResult.keyshare,
        eddsa: schnorrResult.keyshare
      }

      const vault = {
        name: vaultName,
        publicKeys,
        createdAt: Date.now(),
        hexChainCode: dklsResult.chaincode,
        keyShares,
        order: getLastItemOrder(vaultOrders),
        lastPasswordVerificationTime: hasServer(signers) ? Date.now() : undefined,
        ...sharedFinalVaultFields
      }

      console.log('VAULT - ', vaultName)

      await setKeygenComplete({
        serverURL,
        sessionId: sessionId,
        localPartyId
      })

      await waitForKeygenComplete({
        serverURL,
        sessionId: sessionId,
        peers
      })

      return vault
    },
    [hexEncryptionKey, isInitiatingDevice, localPartyId, serverURL, sessionId, vaultName, vaultOrders]
  )

  return <KeygenActionProvider value={keygenAction}>{children}</KeygenActionProvider>
}
