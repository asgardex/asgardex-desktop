import { base, node, rewards } from './bonds'

describe('Bonds routes', () => {
  describe('base', () => {
    it('template', () => {
      expect(base.template).toEqual('/bonds')
    })
    it('path', () => {
      expect(base.path()).toEqual('/bonds')
    })
    it('path with redirect', () => {
      expect(base.path('/pools')).toEqual('/bonds?redirectUrl=/pools')
    })
  })

  describe('node', () => {
    it('template', () => {
      expect(node.template).toEqual('/bonds/node/:nodeAddress')
    })
    it('path', () => {
      expect(node.path({ nodeAddress: 'thor123' })).toEqual('/bonds/node/thor123')
    })
    it('redirects to base with empty param', () => {
      expect(node.path({ nodeAddress: '' })).toEqual('/bonds')
    })
  })

  describe('rewards', () => {
    it('template', () => {
      expect(rewards.template).toEqual('/bonds/rewards')
    })
    it('path', () => {
      expect(rewards.path()).toEqual('/bonds/rewards')
    })
  })
})
