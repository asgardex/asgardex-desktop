import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { TrashIcon as DeleteOutlined, ArrowUturnRightIcon as RedoOutlined } from '@heroicons/react/24/outline'
import shuffleArray from 'lodash.shuffle'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'

import { isError } from '../../../../shared/utils/guard'
import { isSelectedFactory, sortedSelected } from '../../../helpers/array'
import * as walletRoutes from '../../../routes/wallet'
import { FlatButton, TextButton } from '../../uielements/button'
import { Phrase } from './index'
import { checkPhraseConfirmWordsFactory } from './NewPhraseConfirm.helper'
import { WordType } from './NewPhraseConfirm.types'

export const NewPhraseConfirm = ({ mnemonic, onConfirm }: { mnemonic: string; onConfirm: () => Promise<void> }) => {
  const [wordsList, setWordsList] = useState<WordType[]>([])
  const [shuffledWordsList, setShuffledWordsList] = useState<WordType[]>([])
  const [mnemonicError, setMnemonicError] = useState('')
  const [initialized, setInitialized] = useState(false)
  const intl = useIntl()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const updateWordList = useCallback(
    (wordList: WordType[]) => {
      setMnemonicError('')
      setWordsList(wordList)
    },
    [setWordsList, setMnemonicError]
  )
  const shuffledWords = useCallback<(array: WordType[]) => WordType[]>(shuffleArray, [])

  const init = useCallback(() => {
    const words = mnemonic.split(' ')
    if (words && !initialized) {
      const res = words.map((e: string) => {
        const uniqueId = uuidv4()
        return { text: e, _id: uniqueId }
      })
      updateWordList(res)
      setShuffledWordsList(shuffledWords(res))
      setInitialized(true)
    }
  }, [mnemonic, initialized, shuffledWords, updateWordList])

  const sortedSelectedWords = useMemo(() => {
    return sortedSelected(wordsList, 'sequence')
  }, [wordsList])

  useEffect(() => {
    init()
  }, [init])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isSelected = useCallback(isSelectedFactory(wordsList, '_id'), [wordsList])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkPhraseConfirmWords = useCallback(checkPhraseConfirmWordsFactory(updateWordList, setMnemonicError), [
    updateWordList,
    setMnemonicError
  ])

  const handleResetPhrase = useCallback(() => {
    const newWords = wordsList.map((e: WordType) => {
      e.selected = false
      e.error = false
      delete e.sequence
      return e
    })
    updateWordList(newWords)
  }, [wordsList, updateWordList])

  const handleAddWord = useCallback(
    (id: string) => {
      const selects: WordType[] = sortedSelectedWords
      const lastSequence = (selects[selects.length - 1] && selects[selects.length - 1].sequence) || 0
      const newSequence = lastSequence >= 0 ? lastSequence + 1 : 0
      const newWords = wordsList.map((e: WordType) => {
        if (e._id === id) {
          e.selected = true
          e.sequence = newSequence
        }
        return e
      })
      updateWordList(newWords)
    },
    [sortedSelectedWords, wordsList, updateWordList]
  )
  const handleRemoveWord = useCallback(
    (id: string) => {
      const newWords = wordsList.map((e: WordType) => {
        if (e._id === id) {
          e.selected = false
          e.error = false
          delete e.sequence
        }
        return e
      })
      updateWordList(newWords)
    },
    [wordsList, updateWordList]
  )
  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const checkwords = checkPhraseConfirmWords(wordsList, sortedSelectedWords)

      if (checkwords && !loading) {
        setLoading(true)
        onConfirm()
          .then(() => {
            navigate(walletRoutes.base.path())
          })
          .catch((error) => {
            setLoading(false)
            const errorMsg = `${intl.formatMessage({ id: 'wallet.create.error' })} (error: ${
              isError(error) ? error?.message ?? error.toString() : `${error}`
            })`
            setMnemonicError(errorMsg)
          })
      }
      // In case ALL words were entered in a wrong set error
      else if (wordsList.length === sortedSelectedWords.length) {
        setMnemonicError(intl.formatMessage({ id: 'wallet.create.error.phrase' }))
      }
    },
    [checkPhraseConfirmWords, wordsList, sortedSelectedWords, loading, onConfirm, navigate, intl]
  )

  return (
    <div className="flex flex-col w-full">
      <form onSubmit={handleFormSubmit}>
        <h2 className="mb-20px font-mainSemiBold text-sm text-text0 dark:text-text0d">
          {intl.formatMessage({ id: 'wallet.create.enter.phrase' })}
        </h2>
        <div className="flex w-full flex-col items-center justify-center">
          <div className="w-full !mb-2">
            <Phrase
              wordIcon={<DeleteOutlined className="w-4 h-4 text-red" />}
              words={sortedSelectedWords}
              onWordClick={handleRemoveWord}
            />
          </div>

          <span className="text-red text-xs px-2">{mnemonicError}</span>

          <h2 className="w-full flex items-center font-mainSemiBold text-sm text-text0 dark:text-text0d mt-8">
            {intl.formatMessage({ id: 'wallet.create.words.click' })}
            <FlatButton onClick={handleResetPhrase} color="neutral" className="ml-10px">
              <RedoOutlined className="w-4 h-4" />
            </FlatButton>
          </h2>
          <div className="mb-20px w-full grid grid-cols-3 gap-1">
            {shuffledWordsList.map((word: WordType) => (
              <div key={word._id} className="text-center">
                <TextButton
                  className="w-full rounded-xl border border-solid border-gray0 dark:border-gray0d"
                  type="button"
                  uppercase={false}
                  size="large"
                  color="neutral"
                  disabled={isSelected(word._id)}
                  onClick={() => handleAddWord(word._id)}>
                  {word.text}
                </TextButton>
              </div>
            ))}
          </div>
          <FlatButton
            className="mt-4 min-w-40"
            size="large"
            color="primary"
            type="submit"
            loading={loading}
            disabled={loading}>
            {intl.formatMessage({ id: 'common.finish' })}
          </FlatButton>
        </div>
      </form>
    </div>
  )
}
