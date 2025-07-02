type InitiateFileDownloadInput = {
  blob: Blob
  name: string
}

export const initiateFileDownload = ({ blob, name }: InitiateFileDownloadInput) => {
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name

  document.body.appendChild(anchor)
  anchor.click()

  anchor.remove()
  URL.revokeObjectURL(url)
}
