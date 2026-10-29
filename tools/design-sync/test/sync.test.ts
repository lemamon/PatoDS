import { describe, it, expect } from 'vitest'
import { diff, detect, sync, type DesiredVar } from '../src/core.ts'
import { InMemoryDesignTool } from '../src/adapters/memory.ts'

const desired: DesiredVar[] = [
  { name: 'color/bg/surface', value: 'color:mode', key: 'color/bg/surface' },
  { name: 'color/fg/default', value: 'color:mode', key: 'color/fg/default' },
]

describe('design-sync core (US6)', () => {
  it('cria variáveis ausentes na ferramenta', async () => {
    const plan = diff(desired, [])
    expect(plan.map((o) => o.op)).toEqual(['create', 'create'])
  })

  it('sincroniza até verificar (diff vazio)', async () => {
    const tool = new InMemoryDesignTool()
    const res = await sync(tool, desired)
    expect(res.state).toBe('verified')
    expect(await tool.readSnapshot()).toHaveLength(2)
  })

  it('restaura edição manual no destino (DSN-03)', async () => {
    const tool = new InMemoryDesignTool()
    await sync(tool, desired)
    tool.simulateManualEdit('color/bg/surface', 'ADULTERADO')
    const res = await sync(tool, desired)
    expect(res.restored).toContain('color/bg/surface')
    const v = (await tool.readSnapshot()).find((x) => x.name === 'color/bg/surface')!
    expect(v.value).toBe('color:mode')
  })

  it('detecta renomeação por chave em vez de recriar (DSN-04)', async () => {
    const tool = new InMemoryDesignTool()
    await sync(tool, desired)
    tool.simulateRename('color/fg/default', 'color/fg/legacy')
    const plan = diff(desired, await tool.readSnapshot())
    expect(plan.some((o) => o.op === 'rename' && o.name === 'color/fg/default')).toBe(true)
    expect(plan.some((o) => o.op === 'create' && o.name === 'color/fg/default')).toBe(false)
  })

  it('remove variável extra não gerenciada', async () => {
    const tool = new InMemoryDesignTool()
    await sync(tool, desired)
    tool.simulateExtraVariable('color/zzz/extra', 'x')
    const plan = diff(desired, await tool.readSnapshot())
    expect(plan.some((o) => o.op === 'delete' && o.name === 'color/zzz/extra')).toBe(true)
  })

  it('cada op vira divergência rastreável com fingerprint estável (DSN-11)', () => {
    const d = detect(diff(desired, []))
    expect(d).toHaveLength(2)
    expect(d[0]!.fingerprint).toMatch(/^[0-9a-f]{16}$/)
    expect(detect(diff(desired, []))[0]!.fingerprint).toBe(d[0]!.fingerprint)
  })

  it('falha de aplicação resulta em state failed (injeção de falha)', async () => {
    const tool = new InMemoryDesignTool()
    tool.faults.failAfterOperations = 1
    const res = await sync(tool, desired)
    expect(res.state).toBe('failed')
  })

  it('a porta não expõe operação ferramenta → repositório', () => {
    const tool = new InMemoryDesignTool()
    const ops = Object.getOwnPropertyNames(Object.getPrototypeOf(tool))
    expect(ops).not.toContain('writeToRepo')
    expect(ops).toContain('readSnapshot')
    expect(ops).toContain('apply')
  })
})
