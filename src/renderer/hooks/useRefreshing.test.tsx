import { act } from 'react'
import { type Root, createRoot } from 'react-dom/client'

import { useRefreshing } from './useRefreshing'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Api = ReturnType<typeof useRefreshing>

describe('hooks/useRefreshing', () => {
  let container: HTMLDivElement
  let root: Root
  let api: Api

  const Probe = ({ data }: { data: object }) => {
    api = useRefreshing(data)
    return null
  }

  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('is not refreshing initially', () => {
    act(() => root.render(<Probe data={{}} />))
    expect(api.refreshing).toBe(false)
  })

  it('refreshes after start and ends once new data arrives', () => {
    const first = {}
    act(() => root.render(<Probe data={first} />))

    act(() => api.startRefreshing())
    expect(api.refreshing).toBe(true)

    // same data: still refreshing (reload swallowed its Pending state)
    act(() => root.render(<Probe data={first} />))
    expect(api.refreshing).toBe(true)

    // reload delivered new data
    act(() => root.render(<Probe data={{}} />))
    expect(api.refreshing).toBe(false)
  })
})
