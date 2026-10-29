// Deterministic writing (FR-015, SC-002): canonical JSON with code-point-sorted keys, LF, no
// timestamp and no absolute path. Two builds of the same source produce identical bytes.
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

function sortDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key])
    return out
  }
  return value
}

export function canonicalJson(value: any): string {
  return JSON.stringify(sortDeep(value), null, 2) + '\n'
}

export async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text.replace(/\r\n/g, '\n'), 'utf8')
}
