import { combineReducers } from '@reduxjs/toolkit'

import { reducer as appReducer } from './app/slice'

const rootReducer = combineReducers({
  app: appReducer
})

export default rootReducer
