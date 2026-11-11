import { act } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import * as Rx from 'rxjs'
import { vi } from 'vitest'

import { Locale } from '../../../shared/i18n/types'
import { getMessagesByLocale } from '../../i18n'
import EditableUrl, { isValidUrlSyntax } from './EditableUrl'

const messages = getMessagesByLocale(Locale.EN)
const INVALID = messages['settings.url.error.invalid']
const TEST_FAILED = messages['settings.url.error.testFailed']
// What `checkMidgardUrl$` returns for any request failure (also for a well-formed URL)
const HANDLER_ERROR = `${messages['midgard.url.error.invalid']} || 'Midgard can't be accessed'`

let root: Root
let container: HTMLDivElement

const render = (checkUrl$: (url: string) => Rx.Observable<RD.RemoteData<Error, string>>) =>
  act(() => {
    root.render(
      <IntlProvider locale="en" messages={messages}>
        <EditableUrl url="https://midgard.thorchain.network" checkUrl$={checkUrl$} successMsg="Valid Midgard URL" />
      </IntlProvider>
    )
  })

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

const buttonByText = (text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement
const alerts = () => Array.from(container.querySelectorAll('[role="alert"]')).map((el) => el.textContent)
const text = () => container.textContent ?? ''

const startEditing = () => act(() => (container.querySelector('button') as HTMLButtonElement).click())
const typeUrl = (value: string) => {
  const input = container.querySelector('input') as HTMLInputElement
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const submit = async () => {
  await act(async () => {
    ;(container.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )
  })
  await flush()
}

describe('components/settings/EditableUrl', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('isValidUrlSyntax: only absolute http(s) URLs with a host', () => {
    expect(isValidUrlSyntax('https://midgard.thorchain.network')).toBe(true)
    expect(isValidUrlSyntax('http://localhost:8080/v2')).toBe(true)
    expect(isValidUrlSyntax('midgard.thorchain.network')).toBe(false)
    expect(isValidUrlSyntax('ftp://example.com')).toBe(false)
    expect(isValidUrlSyntax('https://')).toBe(false)
    expect(isValidUrlSyntax('not a url')).toBe(false)
  })

  it('valid URL, failed test: one "test failed" message, never "invalid URL" or the repeated handler text', async () => {
    const checkUrl$ = vi.fn(() => Rx.of(RD.failure<Error, string>(Error(HANDLER_ERROR))))
    render(checkUrl$)
    act(() => buttonByText('Test').click())
    await flush()
    expect(checkUrl$).toHaveBeenCalledWith('https://midgard.thorchain.network', expect.anything())
    expect(alerts()).toEqual([TEST_FAILED])
    expect(text()).not.toContain(INVALID)
    expect(text()).not.toContain(messages['midgard.url.error.invalid'])
    expect(text()).not.toContain("can't be accessed")
  })

  it('editing: Test then save of a valid URL whose test fails shows the message once', async () => {
    const checkUrl$ = vi.fn(() => Rx.of(RD.failure<Error, string>(Error(HANDLER_ERROR))))
    render(checkUrl$)
    startEditing()
    typeUrl('https://midgard.example.org')
    act(() => buttonByText('Test').click())
    await flush()
    expect(alerts()).toEqual([TEST_FAILED])
    await submit()
    expect(alerts()).toEqual([TEST_FAILED])
    expect(text()).not.toContain('Error:')
    expect(container.querySelector('input')).not.toBeNull()
  })

  it('malformed URL: "invalid URL" (Test and save), no endpoint test is run', async () => {
    const checkUrl$ = vi.fn(() => Rx.of(RD.success<Error, string>('x')))
    render(checkUrl$)
    startEditing()
    typeUrl('midgard.thorchain.network')
    act(() => buttonByText('Test').click())
    await flush()
    expect(alerts()).toEqual([INVALID])
    await submit()
    expect(alerts()).toEqual([INVALID])
    expect(checkUrl$).not.toHaveBeenCalled()
  })

  it('successful test shows the success message and no error', async () => {
    render(() => Rx.of(RD.success<Error, string>('https://midgard.thorchain.network')))
    act(() => buttonByText('Test').click())
    await flush()
    expect(alerts()).toEqual([])
    expect(text()).toContain('Valid Midgard URL')
  })
})
