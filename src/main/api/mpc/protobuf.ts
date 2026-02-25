/**
 * Protobuf helpers for SDK types not exported from @vultisig/sdk.
 *
 * The SDK uses proto-es v2 (codegenv2) for keysign protobuf messages.
 * Erc20ApprovePayloadSchema is not exported, so we reconstruct it
 * from the same file descriptor the SDK codegen produces.
 *
 * Source: packages/core/mpc/types/vultisig/keysign/v1/erc20_approve_payload_pb.ts
 * Proto:  message Erc20ApprovePayload { string amount = 1; string spender = 2; }
 */

import { create } from '@bufbuild/protobuf'
import { fileDesc, messageDesc } from '@bufbuild/protobuf/codegenv2'

// Serialized FileDescriptorProto for erc20_approve_payload.proto
// Identical to the SDK codegen output — deterministic for the proto definition.
const erc20ApproveFileDesc = fileDesc(
  'Ci92dWx0aXNpZy9rZXlzaWduL3YxL2VyYzIwX2FwcHJvdmVfcGF5bG9hZC5wcm90bxITdnVsdGlzaWcua2V5c2lnbi52MSI2ChNFcmMyMEFwcHJvdmVQYXlsb2FkEg4KBmFtb3VudBgBIAEoCRIPCgdzcGVuZGVyGAIgASgJQlQKE3Z1bHRpc2lnLmtleXNpZ24udjFaOGdpdGh1Yi5jb20vdnVsdGlzaWcvY29tbW9uZGF0YS9nby92dWx0aXNpZy9rZXlzaWduL3YxO3YxugICVlNiBnByb3RvMw'
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Erc20ApprovePayloadSchema = messageDesc(erc20ApproveFileDesc, 0) as any

/**
 * Create a proper protobuf Erc20ApprovePayload message.
 * Required because the SDK serializes keysignPayload using protobuf binary encoding
 * (for QR codes, relay signing), and plain objects fail serialization.
 */
export function createErc20ApprovePayload(params: { amount: string; spender: string }) {
  return create(Erc20ApprovePayloadSchema, params)
}
