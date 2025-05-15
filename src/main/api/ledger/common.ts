const TransportNodeHid = require('@ledgerhq/hw-transport-node-hid').default

export const getTransport = async () => await TransportNodeHid.create()
