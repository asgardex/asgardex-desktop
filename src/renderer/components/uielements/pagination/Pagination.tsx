import React, { useMemo, useState, useEffect } from 'react'

export type Props = {
  total: number
  defaultCurrent?: number
  current?: number
  defaultPageSize?: number
  pageSize?: number
  onChange?: (page: number, pageSize: number) => void
  disabled?: boolean
  className?: string
  hideOnSinglePage?: boolean
}

type PageItem = number | 'DOTS'

const DOTS: PageItem = 'DOTS'

function usePagination(totalItems: number, pageSize: number, currentPage: number, siblingCount = 1): PageItem[] {
  return useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const totalNumbers = siblingCount * 2 + 5

    if (totalNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const leftSibling = Math.max(currentPage - siblingCount, 1)
    const rightSibling = Math.min(currentPage + siblingCount, totalPages)

    const showLeftDots = leftSibling > 2
    const showRightDots = rightSibling < totalPages - 1

    const range: PageItem[] = []

    if (!showLeftDots && showRightDots) {
      const leftItemCount = 3 + 2 * siblingCount
      for (let i = 1; i <= leftItemCount; i++) range.push(i)
      range.push(DOTS, totalPages)
      return range
    }

    if (showLeftDots && !showRightDots) {
      const rightItemCount = 3 + 2 * siblingCount
      range.push(1, DOTS)
      for (let i = totalPages - rightItemCount + 1; i <= totalPages; i++) range.push(i)
      return range
    }

    range.push(1, DOTS)
    for (let i = leftSibling; i <= rightSibling; i++) range.push(i)
    range.push(DOTS, totalPages)
    return range
  }, [totalItems, pageSize, currentPage, siblingCount])
}

export function Pagination({
  total,
  defaultCurrent = 1,
  current, // controlled
  defaultPageSize = 10,
  pageSize, // controlled
  disabled = false,
  className = '',
  hideOnSinglePage = true,
  onChange
}: Props) {
  const [innerPage, setInnerPage] = useState<number>(current ?? defaultCurrent)
  const [innerSize, setInnerSize] = useState<number>(pageSize ?? defaultPageSize)

  const isPageControlled = typeof current === 'number'
  const isSizeControlled = typeof pageSize === 'number'

  const page = isPageControlled ? (current as number) : innerPage
  const size = isSizeControlled ? (pageSize as number) : innerSize

  const totalPages = Math.max(1, Math.ceil(total / Math.max(size, 1)))
  const range = usePagination(total, size, Math.min(page, totalPages), 1)

  useEffect(() => {
    if (isPageControlled) setInnerPage(current as number)
  }, [current, isPageControlled])

  useEffect(() => {
    if (isSizeControlled) setInnerSize(pageSize as number)
  }, [pageSize, isSizeControlled])

  const setPage = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), totalPages)
    if (!isPageControlled) setInnerPage(clamped)
    onChange?.(clamped, size)
  }

  if (hideOnSinglePage && totalPages <= 1) {
    return null
  }

  const btn =
    'flex items-center justify-center min-w-9 px-3 h-9 text-sm rounded-md border border-gray0 dark:border-gray0d bg-bg1 dark:bg-bg1d text-turquoise hover:bg-bg2 hover:dark:bg-bg2d focus:outline-none disabled:cursor-not-allowed'
  const active =
    'flex items-center justify-center min-w-9 px-3 h-9 text-sm rounded-md border border-turquoise bg-turquoise text-white focus:outline-none'

  const iconBtn =
    'flex items-center justify-center w-9 h-9 text-sm rounded-md border border-gray0 dark:border-gray0d bg-bg1 dark:bg-bg1d text-turquoise disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-5 ${className}`} aria-disabled={disabled}>
      <div className="flex items-center gap-2">
        {/* Prev/First */}
        <button type="button" className={iconBtn} onClick={() => setPage(1)} disabled={disabled || page <= 1}>
          «
        </button>
        <button type="button" className={iconBtn} onClick={() => setPage(page - 1)} disabled={disabled || page <= 1}>
          ‹
        </button>

        {/* Pages */}
        {range.map((item, i) =>
          item === DOTS ? (
            <span key={`dots-${i}`} className="px-2 text-sm text-turquoise select-none" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={item === page ? active : btn}
              onClick={() => setPage(item as number)}
              disabled={disabled}>
              {item}
            </button>
          )
        )}

        {/* Next/Last */}
        <button
          type="button"
          className={iconBtn}
          onClick={() => setPage(page + 1)}
          disabled={disabled || page >= totalPages}>
          ›
        </button>
        <button
          type="button"
          className={iconBtn}
          onClick={() => setPage(totalPages)}
          disabled={disabled || page >= totalPages}>
          »
        </button>
      </div>
    </div>
  )
}

export default Pagination
