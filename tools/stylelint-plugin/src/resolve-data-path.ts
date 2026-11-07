// Resolves an option path to an on-disk file (lint-rules.md §2.2):
// - an absolute path is used as-is;
// - a relative path (starts with "." ) resolves from the current working directory, which for the gate
//   is the directory of the Stylelint configuration file that declares it (the gate runs at the repo
//   root, where `stylelint.config.mjs` lives);
// - a package specifier (e.g. "@patods/tokens/meta/tokens.manifest.json") resolves from this plugin's
//   package, which declares the `@patods/tokens` devDependency and its `./meta/*` subpath export.
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function resolveDataPath(p: string): string {
  if (isAbsolute(p)) return p
  if (p.startsWith('.')) return resolve(process.cwd(), p)
  // Bare specifier: resolve from the plugin package (import.meta of this module).
  return fileURLToPath(import.meta.resolve(p))
}
