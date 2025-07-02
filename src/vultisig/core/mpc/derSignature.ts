// Helper function to encode a Uint8Array to DER format
function encodeDERInteger(value: Uint8Array): Uint8Array {
  let byteArray = value

  // If the first byte is >= 0x80, prepend a 0x00 byte
  if (byteArray[0] >= 0x80) {
    const newByteArray = new Uint8Array(byteArray.length + 1)
    newByteArray[0] = 0x00
    newByteArray.set(byteArray, 1)
    byteArray = newByteArray
  }

  const der = new Uint8Array(byteArray.length + 2)
  der[0] = 0x02 // INTEGER tag
  der[1] = byteArray.length // Length
  der.set(byteArray, 2)

  return der
}

// Function to encode r and s values into canonical DER format
export function encodeDERSignature(r: Uint8Array, s: Uint8Array): Uint8Array {
  const rDER = encodeDERInteger(r)
  const sDER = encodeDERInteger(s)

  const der = new Uint8Array(2 + rDER.length + sDER.length)
  der[0] = 0x30 // SEQUENCE tag
  der[1] = rDER.length + sDER.length // Length
  der.set(rDER, 2)
  der.set(sDER, 2 + rDER.length)

  return der
}
