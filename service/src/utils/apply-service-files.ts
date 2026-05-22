import type { ServiceFile } from 'common'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve, sep } from 'path'

const TEMPLATE_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g

/**
 * Result of writing a single file. `unresolved` lists every distinct
 * `{{NAME}}` placeholder that remained in the written content because no
 * matching key was present in the variables map. The file is still written
 * with the placeholder verbatim — surfacing the list lets the caller warn
 * the user instead of failing silently.
 */
export type AppliedServiceFile = {
  relativePath: string
  unresolved: string[]
}

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
 * Collects the distinct `{{NAME}}` placeholders that remain unresolved
 * against the supplied variables map. Order matches first-appearance in the
 * content; duplicates are deduplicated.
 */
export function collectUnresolvedPlaceholders(content: string, variables: Record<string, string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const match of content.matchAll(TEMPLATE_PATTERN)) {
    const name = match[1]
    if (name in variables) continue
    if (seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
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
 * `variables` map before writing. Placeholders without a matching entry are
 * left verbatim and reported back in the returned `unresolved` array per file.
 * @param serviceCwd - Absolute path to the service working directory
 * @param files - Files to write (typically merged shared + local via `mergeServiceFiles`)
 * @param relativePath - If provided, only the file matching this path is written
 * @param variables - Optional map of template variables to interpolate
 * @returns One entry per written file with the relative path and the list of
 *   placeholders that could not be resolved.
 */
export function applyServiceFiles(
  serviceCwd: string,
  files: ServiceFile[],
  relativePath?: string,
  variables?: Record<string, string>,
): AppliedServiceFile[] {
  const toApply = relativePath ? files.filter((f) => f.relativePath === relativePath) : files
  const applied: AppliedServiceFile[] = []

  const resolvedCwd = resolve(serviceCwd)
  const vars = variables ?? {}

  for (const file of toApply) {
    const target = resolve(join(resolvedCwd, file.relativePath))

    if (target !== resolvedCwd && !target.startsWith(`${resolvedCwd}${sep}`)) {
      throw new Error(`File path "${file.relativePath}" resolves outside the service directory`)
    }

    const content = interpolateTemplateVars(file.content, vars)
    const unresolved = collectUnresolvedPlaceholders(content, vars)

    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf-8')
    applied.push({ relativePath: file.relativePath, unresolved })
  }

  return applied
}
