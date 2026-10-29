// In-memory (fake) adapter for tests, with fault injection (design-sync.md). Never writes to the
// repository; implements only the read/write-to-"tool" port.
import type { Capabilities, DesignToolPort, PlanOp, ToolVariable } from '../ports.ts'

export interface Faults {
  failAfterOperations?: number
}

export class InMemoryDesignTool implements DesignToolPort {
  private vars = new Map<string, ToolVariable>()
  private caps: Capabilities
  faults: Faults = {}

  constructor(caps?: Partial<Capabilities>) {
    this.caps = {
      maxModesPerAxis: caps?.maxModesPerAxis ?? 40,
      axisScope: caps?.axisScope ?? 'frame',
      write: caps?.write ?? 'api',
      publish: caps?.publish ?? 'manual',
    }
  }

  capabilities(): Capabilities {
    return this.caps
  }

  async checkAccess(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: true }
  }

  async readSnapshot(): Promise<ToolVariable[]> {
    return [...this.vars.values()].map((v) => ({ ...v })).sort((a, b) => a.name.localeCompare(b.name))
  }

  async apply(plan: PlanOp[], opts?: { dryRun?: boolean }): Promise<void> {
    if (opts?.dryRun) return
    let applied = 0
    for (const op of plan) {
      if (this.faults.failAfterOperations !== undefined && applied >= this.faults.failAfterOperations) {
        throw new Error(`falha simulada após ${applied} operações`)
      }
      switch (op.op) {
        case 'create':
        case 'update':
          this.vars.set(op.name, { name: op.name, value: op.value, key: op.key })
          break
        case 'rename': {
          const prev = this.vars.get(op.from)
          this.vars.delete(op.from)
          this.vars.set(op.name, { name: op.name, value: prev?.value ?? '', key: op.key })
          break
        }
        case 'delete':
          this.vars.delete(op.name)
          break
      }
      applied += 1
    }
  }

  async requestPublish(): Promise<'published' | { manual: string }> {
    return this.caps.publish === 'api' ? 'published' : { manual: 'Publique a biblioteca manualmente.' }
  }

  // Test helpers
  seed(vars: ToolVariable[]): void {
    for (const v of vars) this.vars.set(v.name, { ...v })
  }
  simulateManualEdit(name: string, value: string): void {
    const v = this.vars.get(name)
    if (v) v.value = value
  }
  simulateRename(from: string, to: string): void {
    const v = this.vars.get(from)
    if (v) {
      this.vars.delete(from)
      this.vars.set(to, { ...v, name: to })
    }
  }
  simulateExtraVariable(name: string, value: string): void {
    this.vars.set(name, { name, value, key: name })
  }
}
