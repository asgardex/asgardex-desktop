import { Messages } from '../types'
import bonds from './bonds'
import chainflip from './chainflip'
import common from './common'
import deposit from './deposit'
import error from './error'
import halt from './halt'
import ledger from './ledger'
import midgard from './midgard'
import modal from './modal'
import netstatus from './netstatus'
import pools from './pools'
import poolShares from './poolshares'
import routes from './routes'
import protocolPool from './protocolPool'
import settings from './settings'
import sidebar from './sidebar'
import swap from './swap'
import tcy from './tcy'
import transaction from './transaction'
import update from './update'
import wallet from './wallet'

export default {
  ...common,
  ...chainflip,
  ...transaction,
  ...pools,
  ...routes,
  ...wallet,
  ...settings,
  ...swap,
  ...tcy,
  ...deposit,
  ...protocolPool,
  ...midgard,
  ...ledger,
  ...bonds,
  ...poolShares,
  ...update,
  ...halt,
  ...sidebar,
  ...error,
  ...netstatus,
  ...modal
} as Messages
