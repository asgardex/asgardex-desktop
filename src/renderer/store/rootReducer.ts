import { combineReducers } from '@reduxjs/toolkit'

import { reducer as aggregatorReducer } from './aggregator/slice'
import { reducer as appReducer } from './app/slice'

const rootReducer = combineReducers({
  app: appReducer,
  aggregator: aggregatorReducer
})

export default rootReducer
