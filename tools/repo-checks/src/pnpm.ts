// Runs the workspace package manager for the supply-chain checks (ENG-19, ENG-21). Under a pnpm script
// `npm_execpath` points at the pnpm that is running; otherwise fall back to `pnpm` on PATH.
import { execFileSync } from 'node:child_process'

export function runPnpm(root: string, args: readonly string[]): string {
  const exec = process.env.npm_execpath
  const viaNode = exec !== undefined && /pnpm/.test(exec) && /\.[cm]?js$/.test(exec)
  const [cmd, argv] = viaNode ? [process.execPath, [exec, ...args]] : ['pnpm', [...args]]
  return execFileSync(cmd as string, argv as string[], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
