const TransportNodeHidSingleton = require('@ledgerhq/hw-transport-node-hid')

export const getTransport = async () => await TransportNodeHidSingleton.default.create()
