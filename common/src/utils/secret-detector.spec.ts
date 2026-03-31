import { describe, expect, it } from 'vitest'

import { detectSecretPatterns, detectSecretsInServiceDefinition } from './secret-detector.js'

describe('detectSecretPatterns', () => {
  it('should detect password assignments', () => {
    const warnings = detectSecretPatterns('DB_PASSWORD=hunter2')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.pattern).toBe('password assignment')
    expect(warnings[0]?.line).toBe(1)
  })

  it('should detect secret/api_key assignments', () => {
    const warnings = detectSecretPatterns('API_KEY=abc123def456')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.pattern).toBe('secret/key assignment')
  })

  it('should detect token assignments', () => {
    const warnings = detectSecretPatterns('TOKEN=some-long-token-value')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.pattern).toBe('token assignment')
  })

  it('should detect private key headers', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----'
    const warnings = detectSecretPatterns(pem)
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    expect(warnings[0]?.pattern).toBe('private key header')
  })

  it('should detect GitHub tokens', () => {
    const warnings = detectSecretPatterns('ghp_abcdefghijklmnopqrstuvwxyz1234567890')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.pattern).toBe('GitHub token')
  })

  it('should detect OpenAI-style keys', () => {
    const warnings = detectSecretPatterns('sk-abcdef1234567890abcdef12')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.pattern).toBe('OpenAI-style API key')
  })

  it('should not flag normal config values', () => {
    const content = ['NODE_ENV=production', 'PORT=3000', 'HOST=localhost', 'DEBUG=false', 'LOG_LEVEL=info'].join('\n')
    const warnings = detectSecretPatterns(content)
    expect(warnings).toHaveLength(0)
  })

  it('should not flag {{VARIABLE}} template interpolation in assignments', () => {
    const lines = [
      'password={{POSTGRES_PASSWORD}}',
      'API_KEY={{MY_API_KEY}}',
      'TOKEN={{AUTH_TOKEN}}',
      '"ProfileServiceEntities": "server={{POSTGRES_HOST}};database=ProfileService;uid={{POSTGRES_USER}};password={{POSTGRES_PASSWORD}};"',
    ]
    for (const line of lines) {
      expect(detectSecretPatterns(line)).toHaveLength(0)
    }
  })

  it('should still flag hard-coded values next to template variables on different lines', () => {
    const content = 'password={{SAFE}}\ntoken=hard-coded-secret'
    const warnings = detectSecretPatterns(content)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.line).toBe(2)
    expect(warnings[0]?.pattern).toBe('token assignment')
  })

  it('should report correct line numbers', () => {
    const content = 'line1\nline2\npassword=bad\nline4'
    const warnings = detectSecretPatterns(content)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.line).toBe(3)
  })

  it('should truncate long snippets', () => {
    const longLine = `password=${'a'.repeat(200)}`
    const warnings = detectSecretPatterns(longLine)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.snippet.length).toBeLessThanOrEqual(83)
    expect(warnings[0]?.snippet).toContain('...')
  })

  it('should return empty array for clean content', () => {
    expect(detectSecretPatterns('')).toEqual([])
    expect(detectSecretPatterns('just normal text')).toEqual([])
  })

  it('should detect only one warning per line', () => {
    const warnings = detectSecretPatterns('password=sk-abcdefghijklmnopqrstu')
    expect(warnings).toHaveLength(1)
  })
})

describe('detectSecretsInServiceDefinition', () => {
  it('should scan files content', () => {
    const results = detectSecretsInServiceDefinition({
      files: [
        { relativePath: '.env', content: 'DB_PASSWORD=secret123' },
        { relativePath: 'config.json', content: '{"port": 3000}' },
      ],
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.source).toBe('file: .env')
  })

  it('should include suggestion for file secrets', () => {
    const results = detectSecretsInServiceDefinition({
      files: [{ relativePath: '.env', content: 'password=bad' }],
    })
    expect(results[0]?.suggestion).toContain('local file')
  })

  it('should include suggestion for command secrets', () => {
    const results = detectSecretsInServiceDefinition({
      runCommand: 'password=bad npm start',
    })
    expect(results[0]?.suggestion).toContain('environment variable')
  })

  it('should scan commands', () => {
    const results = detectSecretsInServiceDefinition({
      runCommand: 'API_KEY=abc123 npm start',
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.source).toBe('runCommand')
  })

  it('should scan all command types', () => {
    const results = detectSecretsInServiceDefinition({
      installCommand: 'password=x npm install',
      buildCommand: 'secret=y npm run build',
      runCommand: 'token=z npm start',
    })
    expect(results).toHaveLength(3)
    expect(results.map((r) => r.source)).toContain('installCommand')
    expect(results.map((r) => r.source)).toContain('buildCommand')
    expect(results.map((r) => r.source)).toContain('runCommand')
  })

  it('should return empty array for clean definitions', () => {
    const results = detectSecretsInServiceDefinition({
      files: [{ relativePath: '.env', content: 'NODE_ENV=production' }],
      runCommand: 'npm start',
      installCommand: 'npm install',
    })
    expect(results).toHaveLength(0)
  })
})
