import type { ServiceFile } from 'common'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

/**
 * Writes shared service files to disk relative to the service working directory.
 * Creates parent directories as needed.
 * @param serviceCwd - Absolute path to the service working directory
 * @param files - Files to write
 * @param relativePath - If provided, only the file matching this path is written
 * @returns The list of relative paths that were written
 */
export function applyServiceFiles(serviceCwd: string, files: ServiceFile[], relativePath?: string): string[] {
  const toApply = relativePath ? files.filter((f) => f.relativePath === relativePath) : files
  const applied: string[] = []

  for (const file of toApply) {
    const target = resolve(join(serviceCwd, file.relativePath))

    if (!target.startsWith(serviceCwd)) {
      throw new Error(`File path "${file.relativePath}" resolves outside the service directory`)
    }

    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content, 'utf-8')
    applied.push(file.relativePath)
  }

  return applied
}
