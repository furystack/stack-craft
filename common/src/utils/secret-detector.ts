import type { SecretWarning } from '../apis/stacks.js'

type SecretPatternMatch = Omit<SecretWarning, 'source'>

const SECRET_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /(?:password|passwd|pwd)\s*[=:]\s*(?!\{\{)\S+/i, label: 'password assignment' },
  { regex: /(?:secret|api_?key|apikey|access_?key|auth_?token)\s*[=:]\s*(?!\{\{)\S+/i, label: 'secret/key assignment' },
  { regex: /(?:token|bearer)\s*[=:]\s*(?!\{\{)\S+/i, label: 'token assignment' },
  { regex: /-----BEGIN\s+[\w\s]*(?:PRIVATE|RSA|EC|DSA)\s+KEY-----/, label: 'private key header' },
  { regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/, label: 'GitHub token' },
  { regex: /sk-[A-Za-z0-9]{20,}/, label: 'OpenAI-style API key' },
  { regex: /[A-Za-z0-9+/]{64,}={0,2}(?:\s|$)/, label: 'high-entropy base64 string' },
  { regex: /(?<![A-Za-z0-9])[0-9a-f]{64,}(?:\s|$)/, label: 'high-entropy hex string' },
]

const MAX_SNIPPET_LENGTH = 80

/**
 * Scans text for patterns that commonly indicate hard-coded secrets.
 * Returns warnings with line numbers, the matched pattern name, and a
 * truncated snippet of the matching line.
 */
export const detectSecretPatterns = (text: string): SecretPatternMatch[] => {
  const lines = text.split('\n')
  const warnings: SecretPatternMatch[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { regex, label } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        warnings.push({
          line: i + 1,
          pattern: label,
          snippet: line.length > MAX_SNIPPET_LENGTH ? `${line.slice(0, MAX_SNIPPET_LENGTH)}...` : line,
        })
        break
      }
    }
  }

  return warnings
}

/**
 * Scans service definition fields (files, commands) for potential secrets.
 */
export const detectSecretsInServiceDefinition = (opts: {
  files?: Array<{ relativePath: string; content: string }>
  runCommand?: string
  installCommand?: string
  buildCommand?: string
}): SecretWarning[] => {
  const results: SecretWarning[] = []

  for (const file of opts.files ?? []) {
    for (const warning of detectSecretPatterns(file.content)) {
      results.push({
        ...warning,
        source: `file: ${file.relativePath}`,
        suggestion: 'Move this value to a local file and use {{VARIABLE_NAME}} template interpolation',
      })
    }
  }

  for (const [label, command] of [
    ['runCommand', opts.runCommand],
    ['installCommand', opts.installCommand],
    ['buildCommand', opts.buildCommand],
  ] as const) {
    if (command) {
      for (const warning of detectSecretPatterns(command)) {
        results.push({
          ...warning,
          source: label,
          suggestion: 'Use an environment variable prerequisite instead of inlining the secret',
        })
      }
    }
  }

  return results
}
