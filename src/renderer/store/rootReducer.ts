import { combineReducers } from '@reduxjs/toolkit'

import { reducer as aggregatorReducer } from './aggregator/slice'
import { reducer as appReducer } from './app/slice'
import { reducer as geckoReducer } from './gecko/slice'
import { reducer as vultisigReducer } from './vultisig/slice'

const rootReducer = combineReducers({
  app: appReducer,
  aggregator: aggregatorReducer,
  gecko: geckoReducer,
  vultisig: vultisigReducer
})

export default rootReducer
