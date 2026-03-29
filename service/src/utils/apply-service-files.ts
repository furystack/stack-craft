import type { ServiceFile } from 'common'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve, sep } from 'path'

const TEMPLATE_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g

/**
 * Replaces `{{VARIABLE_NAME}}` placeholders in a string with values from the
 * provided map. Unmatched placeholders are left as-is.
 */
export function interpolateTemplateVars(content: string, variables: Record<string, string>): string {
  return content.replace(TEMPLATE_PATTERN, (match, varName: string) => {
    return varName in variables ? variables[varName] : match
  })
}

/**
 * Merges shared files with local files. Local files take precedence when
 * a `relativePath` appears in both arrays.
 */
export function mergeServiceFiles(sharedFiles: ServiceFile[], localFiles: ServiceFile[]): ServiceFile[] {
  const localPaths = new Set(localFiles.map((f) => f.relativePath))
  const merged = sharedFiles.filter((f) => !localPaths.has(f.relativePath))
  return [...merged, ...localFiles]
}

/**
 * Writes service files to disk relative to the service working directory.
 * Creates parent directories as needed.
 * Supports `{{VARIABLE_NAME}}` placeholders that are resolved from the provided
 * `variables` map before writing.
 * @param serviceCwd - Absolute path to the service working directory
 * @param files - Files to write (typically merged shared + local via `mergeServiceFiles`)
 * @param relativePath - If provided, only the file matching this path is written
 * @param variables - Optional map of template variables to interpolate
 * @returns The list of relative paths that were written
 */
export function applyServiceFiles(
  serviceCwd: string,
  files: ServiceFile[],
  relativePath?: string,
  variables?: Record<string, string>,
): string[] {
  const toApply = relativePath ? files.filter((f) => f.relativePath === relativePath) : files
  const applied: string[] = []

  const resolvedCwd = resolve(serviceCwd)

  for (const file of toApply) {
    const target = resolve(join(resolvedCwd, file.relativePath))

    if (target !== resolvedCwd && !target.startsWith(`${resolvedCwd}${sep}`)) {
      throw new Error(`File path "${file.relativePath}" resolves outside the service directory`)
    }

    const content = variables ? interpolateTemplateVars(file.content, variables) : file.content

    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf-8')
    applied.push(file.relativePath)
  }

  return applied
}
