import { useEffect, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import QRCodeLib from 'qrcode'
import { Spin } from '../spin'

type Props = {
  text: string
  qrError: string
}
export const QRCode = ({ text, qrError }: Props) => {
  const canvasContainer = useRef<HTMLDivElement>(null)

  const [canvasRd, setCanvasRd] = useState<RD.RemoteData<string, HTMLCanvasElement>>(RD.initial)

  useEffect(() => {
    let isActive = true
    setCanvasRd(RD.pending)

    const timeout = setTimeout(() => {
      QRCodeLib.toCanvas(text, { errorCorrectionLevel: 'H', scale: 6 }, (err, canvas) => {
        if (!isActive) return
        if (err) {
          setCanvasRd(RD.failure(qrError))
        } else {
          setCanvasRd(RD.success(canvas))
        }
      })
    }, 500)

    return () => {
      isActive = false
      clearTimeout(timeout)
    }
  }, [text, qrError])

  // Append canvas element to container on success
  useEffect(() => {
    if (RD.isSuccess(canvasRd) && canvasContainer.current) {
      const container = canvasContainer.current
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
      container.appendChild(canvasRd.value)
    }
  }, [canvasRd])

  return (
    <div className="flex h-72 items-center justify-center">
      {(RD.isInitial(canvasRd) || RD.isPending(canvasRd)) && <Spin />}
      {RD.isFailure(canvasRd) && <>{canvasRd.error}</>}
      {RD.isSuccess(canvasRd) && <div ref={canvasContainer} className="[&>canvas]:rounded-2xl" />}
    </div>
  )
}
