export const assertErrorMessage = (message: string | undefined): void => {
  if (message) {
    throw new Error(message)
  }
}
