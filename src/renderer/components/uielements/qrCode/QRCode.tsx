import { useEffect, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import QRCodeLib from 'qrcode'
import { createRoot } from 'react-dom/client'
import { useIntl } from 'react-intl'
import { Spin } from '../spin'

type Props = {
  text: string
  qrError: string
}
export const QRCode = ({ text, qrError }: Props) => {
  const canvasContainer = useRef<HTMLDivElement>(null)
  const intl = useIntl()

  const [canvasRd, setCanvasRd] = useState<RD.RemoteData<string, HTMLCanvasElement>>(RD.initial)

  useEffect(() => {
    setCanvasRd(RD.pending)

    const timeout = setTimeout(() => {
      QRCodeLib.toCanvas(text, { errorCorrectionLevel: 'L', scale: 6 }, (err, canvas) => {
        if (err) {
          setCanvasRd(RD.failure(qrError))
        } else {
          setCanvasRd(RD.success(canvas))
        }
      })
    }, 500)

    return () => {
      clearTimeout(timeout)
    }
  }, [intl, text, setCanvasRd, qrError])

  useEffect(() => {
    FP.pipe(
      canvasRd,
      RD.fold(
        () => {},
        () => {
          if (canvasContainer?.current) {
            createRoot(canvasContainer.current).render(<Spin />)
          }
        },
        (e) => {
          if (canvasContainer?.current) {
            createRoot(canvasContainer.current).render(<>{e}</>)
          }
        },
        (canvas) => {
          FP.pipe(
            O.fromNullable(canvasContainer.current?.firstChild),
            O.fold(
              () => canvasContainer.current?.appendChild(canvas),
              (firstChild) => canvasContainer.current?.replaceChild(canvas, firstChild)
            )
          )
        }
      )
    )
  }, [canvasRd])

  return (
    <div
      ref={canvasContainer}
      className="flex max-h-72 max-w-full items-center justify-center [&>canvas]:h-auto [&>canvas]:max-w-full [&>canvas]:rounded-2xl"
    />
  )
}
