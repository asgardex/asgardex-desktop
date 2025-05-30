const LOAD_FAILURE_SRC = 'fail'
const LOAD_SUCCESS_SRC = 'success'

class MockImage extends EventTarget {
  _src = ''

  set src(src) {
    this._src = src
    setTimeout(() => {
      if (src === LOAD_FAILURE_SRC) {
        this.dispatchEvent(new Event('error'))
      } else if (src === LOAD_SUCCESS_SRC) {
        this.dispatchEvent(new Event('load'))
      }
    }, 0)
  }

  get src() {
    return this._src
  }
}

globalThis.Image = MockImage
