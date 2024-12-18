import { combineReducers } from '@reduxjs/toolkit'

import { reducer as aggregatorReducer } from './aggregator/slice'
import { reducer as appReducer } from './app/slice'
import { reducer as geckoReducer } from './gecko/slice'

const rootReducer = combineReducers({
  app: appReducer,
  aggregator: aggregatorReducer,
  gecko: geckoReducer
})

export default rootReducer
