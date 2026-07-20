import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  applyServiceFiles,
  collectUnresolvedPlaceholders,
  interpolateTemplateVars,
  mergeServiceFiles,
} from './apply-service-files.js'

describe('interpolateTemplateVars', () => {
  it('should replace a single variable', () => {
    expect(interpolateTemplateVars('DB_HOST={{HOST}}', { HOST: 'localhost' })).toBe('DB_HOST=localhost')
  })

  it('should replace multiple variables in one string', () => {
    const result = interpolateTemplateVars('{{USER}}:{{PASS}}@{{HOST}}', {
      USER: 'admin',
      PASS: 's3cret',
      HOST: 'db.local',
    })
    expect(result).toBe('admin:s3cret@db.local')
  })

  it('should leave unmatched placeholders intact', () => {
    expect(interpolateTemplateVars('{{KNOWN}} and {{UNKNOWN}}', { KNOWN: 'yes' })).toBe('yes and {{UNKNOWN}}')
  })

  it('should not modify content without placeholders', () => {
    const content = 'no variables here'
    expect(interpolateTemplateVars(content, { FOO: 'bar' })).toBe(content)
  })

  it('should handle empty variables map', () => {
    expect(interpolateTemplateVars('{{VAR}}', {})).toBe('{{VAR}}')
  })

  it('should handle variables with underscores and numbers', () => {
    expect(interpolateTemplateVars('{{MY_VAR_2}}', { MY_VAR_2: 'value' })).toBe('value')
  })

  it('should not replace partial matches like {VAR} or {{{VAR}}}', () => {
    expect(interpolateTemplateVars('{VAR}', { VAR: 'x' })).toBe('{VAR}')
  })

  it('should handle multiline content', () => {
    const content = 'HOST={{HOST}}\nPORT={{PORT}}\nDEBUG=false'
    const result = interpolateTemplateVars(content, { HOST: '0.0.0.0', PORT: '3000' })
    expect(result).toBe('HOST=0.0.0.0\nPORT=3000\nDEBUG=false')
  })
})

describe('applyServiceFiles with variables', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `apply-files-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  it('should write files with interpolated variables', () => {
    const files = [{ relativePath: '.env', content: 'DB_URL={{DATABASE_URL}}\nSECRET={{API_SECRET}}' }]
    const variables = { DATABASE_URL: 'postgres://localhost/db', API_SECRET: 'abc123' }

    const applied = applyServiceFiles(tempDir, files, undefined, variables)
    expect(applied).toEqual([{ relativePath: '.env', unresolved: [] }])

    const content = readFileSync(join(tempDir, '.env'), 'utf-8')
    expect(content).toBe('DB_URL=postgres://localhost/db\nSECRET=abc123')
  })

  it('should report unresolved placeholders without failing the write', () => {
    const files = [
      { relativePath: '.env', content: 'DB={{POSTGRES_HOST}}\nU={{POSTGRES_USER}}\nP={{POSTGRES_PASSWORD}}' },
    ]
    const variables = { POSTGRES_HOST: 'localhost' }

    const applied = applyServiceFiles(tempDir, files, undefined, variables)
    expect(applied).toEqual([{ relativePath: '.env', unresolved: ['POSTGRES_USER', 'POSTGRES_PASSWORD'] }])
    const content = readFileSync(join(tempDir, '.env'), 'utf-8')
    expect(content).toBe('DB=localhost\nU={{POSTGRES_USER}}\nP={{POSTGRES_PASSWORD}}')
  })

  it('should deduplicate repeated unresolved placeholders', () => {
    const files = [{ relativePath: '.env', content: '{{X}} {{Y}} {{X}} {{Y}}' }]
    const applied = applyServiceFiles(tempDir, files, undefined, {})
    expect(applied[0].unresolved).toEqual(['X', 'Y'])
  })

  it('should write files without variables when none provided', () => {
    const files = [{ relativePath: 'config.json', content: '{"key": "{{VALUE}}"}' }]

    const applied = applyServiceFiles(tempDir, files)
    expect(applied).toEqual([{ relativePath: 'config.json', unresolved: ['VALUE'] }])
    const content = readFileSync(join(tempDir, 'config.json'), 'utf-8')
    expect(content).toBe('{"key": "{{VALUE}}"}')
  })

  it('should write files without variables when empty map provided', () => {
    const files = [{ relativePath: 'config.json', content: '{"key": "{{VALUE}}"}' }]

    const applied = applyServiceFiles(tempDir, files, undefined, {})
    expect(applied).toEqual([{ relativePath: 'config.json', unresolved: ['VALUE'] }])
    const content = readFileSync(join(tempDir, 'config.json'), 'utf-8')
    expect(content).toBe('{"key": "{{VALUE}}"}')
  })

  it('should reject paths that escape the service directory', () => {
    const files = [{ relativePath: '../escape.txt', content: 'bad' }]
    expect(() => applyServiceFiles(tempDir, files)).toThrow('resolves outside the service directory')
  })

  it('should create nested directories', () => {
    const files = [{ relativePath: 'a/b/c/deep.txt', content: '{{VAL}}' }]
    applyServiceFiles(tempDir, files, undefined, { VAL: 'deep' })

    const content = readFileSync(join(tempDir, 'a/b/c/deep.txt'), 'utf-8')
    expect(content).toBe('deep')
  })

  it('should filter by relativePath when provided', () => {
    const files = [
      { relativePath: '.env', content: 'A=1' },
      { relativePath: 'config.json', content: '{}' },
    ]

    const applied = applyServiceFiles(tempDir, files, '.env')
    expect(applied).toEqual([{ relativePath: '.env', unresolved: [] }])
    expect(existsSync(join(tempDir, '.env'))).toBe(true)
    expect(existsSync(join(tempDir, 'config.json'))).toBe(false)
  })
})

describe('collectUnresolvedPlaceholders', () => {
  it('returns an empty list when every placeholder resolves', () => {
    expect(collectUnresolvedPlaceholders('A={{X}};B={{Y}}', { X: 'x', Y: 'y' })).toEqual([])
  })

  it('returns the distinct unresolved names in first-appearance order', () => {
    expect(collectUnresolvedPlaceholders('{{B}} {{A}} {{B}} {{C}} {{A}}', {})).toEqual(['B', 'A', 'C'])
  })

  it('treats known names as resolved even when the same template has unknown ones', () => {
    expect(collectUnresolvedPlaceholders('{{KNOWN}} {{UNKNOWN}}', { KNOWN: 'k' })).toEqual(['UNKNOWN'])
  })
})

describe('mergeServiceFiles', () => {
  it('should return shared files when no local files', () => {
    const shared = [{ relativePath: '.env', content: 'A=1' }]
    const result = mergeServiceFiles(shared, [])
    expect(result).toEqual(shared)
  })

  it('should return local files when no shared files', () => {
    const local = [{ relativePath: '.env', content: 'SECRET=x' }]
    const result = mergeServiceFiles([], local)
    expect(result).toEqual(local)
  })

  it('should let local files override shared files with same path', () => {
    const shared = [
      { relativePath: '.env', content: 'SHARED_VALUE' },
      { relativePath: 'config.json', content: '{}' },
    ]
    const local = [{ relativePath: '.env', content: 'LOCAL_SECRET' }]
    const result = mergeServiceFiles(shared, local)
    expect(result).toHaveLength(2)
    expect(result.find((f) => f.relativePath === '.env')?.content).toBe('LOCAL_SECRET')
    expect(result.find((f) => f.relativePath === 'config.json')?.content).toBe('{}')
  })

  it('should include both shared and local when paths differ', () => {
    const shared = [{ relativePath: 'a.txt', content: 'A' }]
    const local = [{ relativePath: 'b.txt', content: 'B' }]
    const result = mergeServiceFiles(shared, local)
    expect(result).toHaveLength(2)
  })
})
