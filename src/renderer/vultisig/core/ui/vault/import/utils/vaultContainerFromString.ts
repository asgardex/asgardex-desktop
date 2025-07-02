import { fromBinary } from '@bufbuild/protobuf'
import { fromBase64 } from '../../../../../lib/utils/fromBase64'
import { pipe } from '../../../../../lib/utils/pipe'
import { VaultContainerSchema } from '../../../../mpc/types/vultisig/vault/v1/vault_container_pb'

export const vaultContainerFromString = (value: string) =>
  pipe(value, fromBase64, (binary) => fromBinary(VaultContainerSchema, binary))
