import { Messages } from '../types'
import bonds from './bonds'
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
import runePool from './runePool'
import settings from './settings'
import sidebar from './sidebar'
import swap from './swap'
import tcy from './tcy'
import transaction from './transaction'
import update from './update'
import wallet from './wallet'

export default {
  ...common,
  ...transaction,
  ...pools,
  ...routes,
  ...wallet,
  ...settings,
  ...swap,
  ...tcy,
  ...deposit,
  ...runePool,
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
