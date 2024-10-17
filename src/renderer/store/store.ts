import { configureStore } from '@reduxjs/toolkit'
import logger from 'redux-logger'

import rootReducer from './rootReducer'

const middlewares = process.env.NODE_ENV === 'development' ? [logger] : []

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }).concat(middlewares)
})

export type RootState = ReturnType<typeof store.getState>

export type AppDispatch = typeof store.dispatch
