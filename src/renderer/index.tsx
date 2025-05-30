import React from 'react'

import './index.css'
import { createRoot } from 'react-dom/client'

import { App } from './App'

// // Registers custom headers (9R endpoints only)
// register9Rheader('')

// React 18 introduces a new root API
// @see https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html#updates-to-client-rendering-apis
const container = document.getElementById('root')

const root = createRoot(container!) // createRoot(container!) if you use TypeScript
root.render(<App />)
