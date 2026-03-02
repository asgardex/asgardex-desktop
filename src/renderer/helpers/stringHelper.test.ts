import { truncateMiddle } from './stringHelper'

describe('helpers/stringHelper/', () => {
  describe('truncateMiddle', () => {
    it('default', () => {
      const result = truncateMiddle('hello-world')
      expect(result).toEqual('hel...rld')
    })
    it('max', () => {
      let result = truncateMiddle('hello-world', { max: 5 })
      expect(result).toEqual('hel...rld')
      result = truncateMiddle('hello-world', { max: 1 })
      expect(result).toEqual('hel...rld')
      result = truncateMiddle('helloworld', { max: 10 })
      expect(result).toEqual('helloworld')
    })
    it('start', () => {
      let result = truncateMiddle('hello-world', { start: 2 })
      expect(result).toEqual('he...rld')
      result = truncateMiddle('hello-world', { start: 1 })
      expect(result).toEqual('h...rld')
      result = truncateMiddle('hello-world', { start: 5 })
      expect(result).toEqual('hello-world')
    })
    it('end', () => {
      let result = truncateMiddle('hello-world', { end: 2 })
      expect(result).toEqual('hel...ld')
      result = truncateMiddle('hello-world', { end: 1 })
      expect(result).toEqual('hel...d')
      result = truncateMiddle('hello-world', { end: 5 })
      expect(result).toEqual('hello-world')
    })
    it('delimiter', () => {
      let result = truncateMiddle('hello-world', { delimiter: '#-#' })
      expect(result).toEqual('hel#-#rld')
      result = truncateMiddle('hello-world', { delimiter: '############' })
      expect(result).toEqual('hello-world')
    })
  })
})
