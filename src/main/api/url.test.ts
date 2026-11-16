import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openExternal } from './url'

const { shellOpenExternal } = vi.hoisted(() => ({
  shellOpenExternal: vi.fn(() => Promise.resolve())
}))

vi.mock('electron', () => ({
  shell: {
    openExternal: shellOpenExternal
  }
}))

describe('openExternal', () => {
  beforeEach(() => {
    shellOpenExternal.mockClear()
  })

  it('opens an https URL on an allowed host, including a runebond.com subdomain', async () => {
    await openExternal('https://runebond.com/nodes')
    await openExternal('https://abcd.runebond.com/profile')
    await openExternal('https://github.com/asgardex/asgardex-desktop')

    expect(shellOpenExternal).toHaveBeenNthCalledWith(1, 'https://runebond.com/nodes')
    expect(shellOpenExternal).toHaveBeenNthCalledWith(2, 'https://abcd.runebond.com/profile')
    expect(shellOpenExternal).toHaveBeenNthCalledWith(3, 'https://github.com/asgardex/asgardex-desktop')
  })

  it.each([
    'ms-msdt://runebond.com',
    'search-ms://runebond.com',
    'file://runebond.com/etc/passwd',
    'smb://runebond.com/share',
    'http://runebond.com',
    'https://user:pass@runebond.com/a',
    'https://runebond.com:8443/a',
    'https://runebond.com.attacker.example',
    'https://evilrunebond.com',
    'not a url'
  ])('blocks %s', async (target) => {
    await expect(openExternal(target)).rejects.toEqual(expect.stringContaining(target))
    expect(shellOpenExternal).not.toHaveBeenCalled()
  })
})
