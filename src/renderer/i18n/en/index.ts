import { Messages } from '../types'
import bonds from './bonds'
import common from './common'
import deposit from './deposit'
import halt from './halt'
import ledger from './ledger'
import midgard from './midgard'
import pools from './pools'
import poolShares from './poolshares'
import routes from './routes'
import runePool from './runePool'
import settings from './settings'
import swap from './swap'
import tcy from './tcy'
import update from './update'
import wallet from './wallet'

export default {
  ...common,
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
  ...halt
} as Messages
