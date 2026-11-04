import { renderToStaticMarkup } from 'react-dom/server'

import { renderRefreshHeader } from './PoolsOverview.shared'

const render = (props: { refreshing: boolean; isDesktopView?: boolean }) =>
  renderToStaticMarkup(renderRefreshHeader({ onClick: () => {}, isDesktopView: true, label: 'Refresh', ...props }))

describe('views/pools/PoolsOverview.shared', () => {
  describe('renderRefreshHeader', () => {
    it('is enabled and not spinning while idle', () => {
      const html = render({ refreshing: false })
      expect(html).not.toContain('animate-spin')
      expect(html).not.toContain('disabled')
      expect(html).toContain('Refresh')
    })

    it('spins and is disabled while refreshing', () => {
      const html = render({ refreshing: true })
      expect(html).toContain('animate-spin')
      expect(html).toContain('disabled')
    })

    it('hides the label on small views', () => {
      const html = render({ refreshing: false, isDesktopView: false })
      expect(html).not.toContain('Refresh')
    })
  })
})
