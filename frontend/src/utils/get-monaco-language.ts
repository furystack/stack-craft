const extensionLanguageMap: Record<string, string> = {
  '.json': 'json',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.env': 'ini',
  '.ini': 'ini',
  '.toml': 'ini',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.py': 'python',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.dockerfile': 'dockerfile',
}

/**
 * Maps a file path to a Monaco editor language ID based on its extension.
 * Falls back to 'plaintext' for unknown extensions.
 */
export const getMonacoLanguage = (relativePath: string): string => {
  const lowerPath = relativePath.toLowerCase()
  const baseName = lowerPath.split('/').pop() ?? lowerPath
  if (baseName === 'dockerfile' || baseName.endsWith('.dockerfile')) return 'dockerfile'
  const dotIndex = baseName.lastIndexOf('.')
  if (dotIndex === -1) return 'plaintext'
  const ext = baseName.substring(dotIndex)
  return extensionLanguageMap[ext] ?? 'plaintext'
}
