import React from 'react'

import type { WordType } from './NewPhraseConfirm.types'

type Props = {
  words: WordType[]
  onWordClick?: (id: string) => void
  readOnly?: boolean
  wordIcon?: React.ReactNode
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Phrase = ({ words, onWordClick = () => {}, readOnly, wordIcon = null }: Props) => {
  return (
    <div className="grid grid-cols-3 rounded-xl p-2 gap-1 min-h-[142px] border border-solid border-gray0 dark:border-gray0d">
      {words.map((word, index) => (
        <div
          key={word._id}
          className="flex items-center justify-between bg-turquoise/10 px-2 py-1 rounded-full max-h-7"
          onClick={readOnly ? undefined : () => onWordClick(word._id)}>
          <span key={word._id} className="text-sm text-text0 dark:text-text0d font-bold">
            {index + 1}. {word.text}
          </span>
          {wordIcon}
        </div>
      ))}
      {Array.from({ length: 12 - words.length }, (_, i) => i).map((_, index) => (
        <div key={index} className="bg-turquoise/10 px-2 py-1 rounded-full max-h-7 h-7" />
      ))}
    </div>
  )
}
