const TransportNodeHidSingleton = require('@ledgerhq/hw-transport-node-hid-singleton')

export const getTransport = async () => await TransportNodeHidSingleton.default.create()
