import { describe, it, expect, beforeEach } from 'vitest'

// Reset singleton between tests by re-importing the module fresh each time.
// vitest supports this via vi.resetModules().
import { vi } from 'vitest'

describe('getClientRuntime', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns the same singleton on repeated calls', async () => {
    const { getClientRuntime } = await import('../lib/runtime/getClientRuntime')
    const a = getClientRuntime()
    const b = getClientRuntime()
    expect(a).toBe(b)
  })

  it('starts with an empty plugins array', async () => {
    const { getClientRuntime } = await import('../lib/runtime/getClientRuntime')
    expect(getClientRuntime().plugins).toHaveLength(0)
  })

  it('install() pushes a plugin into the array', async () => {
    const { getClientRuntime } = await import('../lib/runtime/getClientRuntime')
    const rt = getClientRuntime()
    const plugin = vi.fn()
    rt.install(plugin)
    expect(rt.plugins).toHaveLength(1)
    expect(rt.plugins[0]).toBe(plugin)
  })

  it('multiple install() calls accumulate plugins', async () => {
    const { getClientRuntime } = await import('../lib/runtime/getClientRuntime')
    const rt = getClientRuntime()
    rt.install(vi.fn())
    rt.install(vi.fn())
    rt.install(vi.fn())
    expect(rt.plugins).toHaveLength(3)
  })
})
