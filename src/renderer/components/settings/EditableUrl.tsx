import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CheckCircleIcon, PencilSquareIcon, XCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useForm } from 'react-hook-form'
import { IntlShape, useIntl } from 'react-intl'
import { lastValueFrom } from 'rxjs'

import { LiveData } from '../../helpers/rx/liveData'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import { BaseButton, BorderButton, TextButton } from '../uielements/button'
import { Input } from '../uielements/input'

type FormData = {
  url: string
}

type TestUrlRD = RD.RemoteData<Error, string>
type TestUrlLD = LiveData<Error, string>
type TestUrlHandler = (url: string, intl: IntlShape) => TestUrlLD

type Props = {
  url: string
  checkUrl$: TestUrlHandler
  successMsg: string
  loading?: boolean
  onChange?: (url: string) => void
  className?: string
}

/**
 * URL syntax only: an absolute `http(s)://` URL with a host. Says nothing about whether the endpoint works.
 */
export const isValidUrlSyntax = (url: string): boolean => {
  try {
    const { protocol, hostname } = new URL(url)
    return (protocol === 'http:' || protocol === 'https:') && hostname.length > 0
  } catch {
    return false
  }
}

const EditableUrl = (props: Props): JSX.Element => {
  const { url: initialUrl, className, successMsg, loading = false, onChange = FP.constVoid, checkUrl$ } = props

  const [editableUrl, setEditableUrl] = useState<O.Option<string>>(O.none)
  const [url, setUrl] = useState<string>(initialUrl)

  useEffect(() => {
    setUrl(initialUrl)
  }, [initialUrl])

  const intl = useIntl()

  const {
    register,
    formState: { errors },
    reset,
    handleSubmit,
    getValues,
    setError,
    clearErrors
  } = useForm<FormData>()

  // Two different causes, one message each:
  // - invalid: the URL itself is malformed (checked here, before any request)
  // - test failed: a well-formed URL whose endpoint test failed. The handler's own error text is not shown, it
  //   may call any failure an "invalid URL" and does not tell the cause.
  const invalidUrlMsg = intl.formatMessage({ id: 'settings.url.error.invalid' })
  const testFailedMsg = intl.formatMessage({ id: 'settings.url.error.testFailed' })

  const {
    state: testUrlState,
    subscribe: subscribeTestUrlState,
    reset: resetTestUrlState
  } = useSubscriptionState<TestUrlRD>(RD.initial)

  const testUrl = useCallback((urlToTest: string): TestUrlLD => checkUrl$(urlToTest, intl), [checkUrl$, intl])

  const testUrlAsPromise = useCallback(
    (urlToTest: string): Promise<TestUrlRD> => lastValueFrom(testUrl(urlToTest)),
    [testUrl]
  )

  const runTestUrlHandler = useCallback(() => {
    const urlToTest = FP.pipe(
      editableUrl, // check editable state
      O.fold(
        () => url, // none editable state: Get value from state
        (_) => getValues().url // editable state: Get value from from
      )
    )
    resetTestUrlState()
    clearErrors('url')
    if (!isValidUrlSyntax(urlToTest)) {
      setError('url', { type: 'custom', message: invalidUrlMsg })
      return
    }
    subscribeTestUrlState(testUrl(urlToTest))
  }, [
    clearErrors,
    editableUrl,
    getValues,
    invalidUrlMsg,
    resetTestUrlState,
    setError,
    subscribeTestUrlState,
    testUrl,
    url
  ])

  // One message area for both modes: a form error (invalid URL, failed test on save) wins over a failed test
  const errorMsg = errors.url?.message ?? (RD.isFailure(testUrlState) ? testFailedMsg : undefined)

  const renderTestUrlResult = useMemo(() => {
    if (errorMsg)
      return (
        <p role="alert" className="mt-2 font-main text-[13px] text-error0 dark:text-error0d">
          {errorMsg}
        </p>
      )
    if (RD.isSuccess(testUrlState)) return <p className="mt-2 font-main text-[13px] text-turquoise">{successMsg}</p>
    return <></>
  }, [errorMsg, successMsg, testUrlState])

  const renderUrl = useCallback(() => {
    const edit = () => {
      resetTestUrlState()
      clearErrors('url')
      setEditableUrl(O.some(url))
    }
    return (
      <div className="flex items-center">
        <TextButton
          className={clsx(
            'flex items-center !p-0 text-[16px] whitespace-nowrap',
            loading ? 'cursor-not-allowed' : 'cursor-pointer'
          )}
          color="neutral"
          uppercase={false}
          disabled={loading || RD.isPending(testUrlState)}
          size="large"
          loading={loading}
          onClick={edit}>
          {url}
          <PencilSquareIcon className="dark:text0d ml-[5px] h-[20px] w-[20px] text-turquoise" />
        </TextButton>
        <BorderButton
          className="ml-10px"
          loading={RD.isPending(testUrlState)}
          disabled={RD.isPending(testUrlState)}
          size="medium"
          color="neutral"
          onClick={runTestUrlHandler}>
          {intl.formatMessage({ id: 'common.test' })}
        </BorderButton>
      </div>
    )
  }, [clearErrors, intl, loading, resetTestUrlState, runTestUrlHandler, testUrlState, url])

  const renderEditableUrl = useCallback(
    (name: string) => {
      const cancel = () => {
        reset()
        clearErrors('url')
        resetTestUrlState()
        setEditableUrl(O.none)
      }
      const submit = async ({ url: formUrl }: FormData) => {
        resetTestUrlState()
        // Remove always trailing slash
        const url = formUrl.replace(/\/$/, '')
        if (!url) {
          setError('url', { type: 'custom', message: 'url required' })
        } else if (!isValidUrlSyntax(url)) {
          setError('url', { type: 'custom', message: invalidUrlMsg })
        } else {
          testUrlAsPromise(url)
            .then(
              FP.flow(
                RD.fold(
                  () => {},
                  () => {},
                  () => setError('url', { type: 'custom', message: testFailedMsg }),
                  (_) => {
                    setEditableUrl(O.none)
                    onChange(url)
                    setUrl(url)
                    reset()
                  }
                )
              )
            )
            .catch((_) => {
              setError('url', { type: 'custom', message: testFailedMsg })
            })
        }
      }

      const keyDownHandler = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Escape') {
          cancel()
        }
      }
      return (
        <form className="flex w-full flex-col" onSubmit={handleSubmit(submit)}>
          <div className="flex w-full items-center">
            <Input
              id="url"
              className={clsx(
                'flex w-auto min-w-[300px] grow text-[16px] focus:border-turquoise',
                RD.isSuccess(testUrlState) ? '!ring-2 !ring-turquoise' : ''
              )}
              size="normal"
              defaultValue={name}
              autoFocus
              uppercase={false}
              {...register('url', { required: true })}
              error={!!errorMsg}
              onKeyDown={keyDownHandler}
            />
            <BaseButton className="!p-0 text-turquoise" onClick={handleSubmit(submit)} type="submit">
              <CheckCircleIcon className="ml-[5px] h-[24px] w-[24px]" />
            </BaseButton>
            <BaseButton className="!p-0 text-error0" onClick={cancel}>
              <XCircleIcon className="ml-[5px] h-[24px] w-[24px]" />
            </BaseButton>
            <BorderButton
              className="ml-10px"
              loading={RD.isPending(testUrlState)}
              disabled={RD.isPending(testUrlState)}
              size="medium"
              color="neutral"
              onClick={runTestUrlHandler}>
              {intl.formatMessage({ id: 'common.test' })}
            </BorderButton>
          </div>
        </form>
      )
    },
    [
      clearErrors,
      errorMsg,
      handleSubmit,
      intl,
      invalidUrlMsg,
      onChange,
      register,
      reset,
      resetTestUrlState,
      runTestUrlHandler,
      setError,
      testFailedMsg,
      testUrlAsPromise,
      testUrlState
    ]
  )

  return (
    <div className={className}>
      {FP.pipe(editableUrl, O.fold(renderUrl, renderEditableUrl))}
      {renderTestUrlResult}
    </div>
  )
}

export default EditableUrl
