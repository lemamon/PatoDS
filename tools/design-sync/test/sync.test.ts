import { describe, it, expect } from 'vitest'
import { diff, detect, sync, type DesiredVar } from '../src/core.ts'
import { InMemoryDesignTool } from '../src/adapters/memory.ts'

const desired: DesiredVar[] = [
  { name: 'color/bg/surface', value: 'color:mode', key: 'color/bg/surface' },
  { name: 'color/fg/default', value: 'color:mode', key: 'color/fg/default' },
]

describe('design-sync core (US6)', () => {
  it('creates missing variables in the tool', async () => {
    const plan = diff(desired, [])
    expect(plan.map((o) => o.op)).toEqual(['create', 'create'])
  })

  it('syncs until verified (empty diff)', async () => {
    const tool = new InMemoryDesignTool()
    const res = await sync(tool, desired)
    expect(res.state).toBe('verified')
    expect(await tool.readSnapshot()).toHaveLength(2)
  })

  it('restores manual edit in the destination (DSN-03)', async () => {
    const tool = new InMemoryDesignTool()
    await sync(tool, desired)
    tool.simulateManualEdit('color/bg/surface', 'TAMPERED')
    const res = await sync(tool, desired)
    expect(res.restored).toContain('color/bg/surface')
    const v = (await tool.readSnapshot()).find((x) => x.name === 'color/bg/surface')!
    expect(v.value).toBe('color:mode')
  })

  it('detects rename by key instead of recreating (DSN-04)', async () => {
    const tool = new InMemoryDesignTool()
    await sync(tool, desired)
    tool.simulateRename('color/fg/default', 'color/fg/legacy')
    const plan = diff(desired, await tool.readSnapshot())
    expect(plan.some((o) => o.op === 'rename' && o.name === 'color/fg/default')).toBe(true)
    expect(plan.some((o) => o.op === 'create' && o.name === 'color/fg/default')).toBe(false)
  })

  it('removes unmanaged extra variable', async () => {
    const tool = new InMemoryDesignTool()
    await sync(tool, desired)
    tool.simulateExtraVariable('color/zzz/extra', 'x')
    const plan = diff(desired, await tool.readSnapshot())
    expect(plan.some((o) => o.op === 'delete' && o.name === 'color/zzz/extra')).toBe(true)
  })

  it('each op becomes a traceable divergence with a stable fingerprint (DSN-11)', () => {
    const d = detect(diff(desired, []))
    expect(d).toHaveLength(2)
    expect(d[0]!.fingerprint).toMatch(/^[0-9a-f]{16}$/)
    expect(detect(diff(desired, []))[0]!.fingerprint).toBe(d[0]!.fingerprint)
  })

  it('apply failure results in state failed (fault injection)', async () => {
    const tool = new InMemoryDesignTool()
    tool.faults.failAfterOperations = 1
    const res = await sync(tool, desired)
    expect(res.state).toBe('failed')
  })

  it('the port does not expose a tool → repository operation', () => {
    const tool = new InMemoryDesignTool()
    const ops = Object.getOwnPropertyNames(Object.getPrototypeOf(tool))
    expect(ops).not.toContain('writeToRepo')
    expect(ops).toContain('readSnapshot')
    expect(ops).toContain('apply')
  })
})
