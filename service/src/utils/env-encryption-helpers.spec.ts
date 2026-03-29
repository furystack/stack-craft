import { randomBytes } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CryptoService, SENSITIVE_VALUE_MASK, UNCHANGED_SENTINEL } from './crypto-service.js'
import {
  decryptEnvValues,
  decryptLocalFiles,
  encryptEnvValues,
  encryptLocalFiles,
  maskLocalFiles,
  maskSensitiveEnvValues,
} from './env-encryption-helpers.js'

describe('env-encryption-helpers', () => {
  let crypto: CryptoService
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.STACK_CRAFT_ENCRYPTION_KEY
    const key = randomBytes(32)
    process.env.STACK_CRAFT_ENCRYPTION_KEY = key.toString('base64')
    crypto = new CryptoService()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STACK_CRAFT_ENCRYPTION_KEY = originalEnv
    } else {
      delete process.env.STACK_CRAFT_ENCRYPTION_KEY
    }
  })

  describe('encryptEnvValues', () => {
    it('should encrypt sensitive custom values', () => {
      const values = {
        SECRET: { source: 'custom' as const, customValue: 'plain-text-secret', isSensitive: true },
      }
      const result = encryptEnvValues(crypto, values)
      expect(result.SECRET.customValue).not.toBe('plain-text-secret')
      expect(crypto.isEncrypted(result.SECRET.customValue!)).toBe(true)
    })

    it('should not encrypt non-sensitive values', () => {
      const values = {
        NORMAL: { source: 'custom' as const, customValue: 'visible-value' },
      }
      const result = encryptEnvValues(crypto, values)
      expect(result.NORMAL.customValue).toBe('visible-value')
    })

    it('should not encrypt inherit-source values even when sensitive', () => {
      const values = {
        INHERIT_VAR: { source: 'inherit' as const, isSensitive: true },
      }
      const result = encryptEnvValues(crypto, values)
      expect(result.INHERIT_VAR).toEqual(values.INHERIT_VAR)
    })

    it('should skip already-encrypted values', () => {
      const encrypted = crypto.encrypt('secret')
      const values = {
        ALREADY: { source: 'custom' as const, customValue: encrypted, isSensitive: true },
      }
      const result = encryptEnvValues(crypto, values)
      expect(result.ALREADY.customValue).toBe(encrypted)
    })

    it('should replace UNCHANGED_SENTINEL with existing value', () => {
      const encrypted = crypto.encrypt('original-secret')
      const existingValues = {
        SECRET: { source: 'custom' as const, customValue: encrypted, isSensitive: true },
      }
      const values = {
        SECRET: { source: 'custom' as const, customValue: UNCHANGED_SENTINEL, isSensitive: true },
      }
      const result = encryptEnvValues(crypto, values, existingValues)
      expect(result.SECRET.customValue).toBe(encrypted)
    })
  })

  describe('decryptEnvValues', () => {
    it('should decrypt encrypted values', () => {
      const encrypted = crypto.encrypt('my-secret')
      const values = {
        SECRET: { source: 'custom' as const, customValue: encrypted, isSensitive: true },
      }
      const result = decryptEnvValues(crypto, values)
      expect(result.SECRET.customValue).toBe('my-secret')
    })

    it('should pass through non-encrypted values', () => {
      const values = {
        NORMAL: { source: 'custom' as const, customValue: 'plain' },
      }
      const result = decryptEnvValues(crypto, values)
      expect(result.NORMAL.customValue).toBe('plain')
    })
  })

  describe('maskSensitiveEnvValues', () => {
    it('should mask encrypted values', () => {
      const encrypted = crypto.encrypt('secret')
      const values = {
        SECRET: { source: 'custom' as const, customValue: encrypted, isSensitive: true },
        NORMAL: { source: 'custom' as const, customValue: 'visible' },
      }
      const result = maskSensitiveEnvValues(crypto, values, '****')
      expect(result.SECRET.customValue).toBe('****')
      expect(result.NORMAL.customValue).toBe('visible')
    })

    it('should not mask non-encrypted values even if marked sensitive', () => {
      const values = {
        VAR: { source: 'custom' as const, customValue: 'plain', isSensitive: true },
      }
      const result = maskSensitiveEnvValues(crypto, values, '****')
      expect(result.VAR.customValue).toBe('plain')
    })
  })

  describe('encryptLocalFiles', () => {
    it('should encrypt file content', () => {
      const files = [{ relativePath: '.env', content: 'SECRET=abc123' }]
      const result = encryptLocalFiles(crypto, files)
      expect(result).toHaveLength(1)
      expect(result[0].relativePath).toBe('.env')
      expect(crypto.isEncrypted(result[0].content)).toBe(true)
    })

    it('should skip already-encrypted content', () => {
      const encrypted = crypto.encrypt('original')
      const files = [{ relativePath: '.env', content: encrypted }]
      const result = encryptLocalFiles(crypto, files)
      expect(result[0].content).toBe(encrypted)
    })

    it('should handle UNCHANGED_SENTINEL by preserving existing', () => {
      const encrypted = crypto.encrypt('secret-data')
      const existing = [{ relativePath: '.env', content: encrypted }]
      const files = [{ relativePath: '.env', content: UNCHANGED_SENTINEL }]
      const result = encryptLocalFiles(crypto, files, existing)
      expect(result[0].content).toBe(encrypted)
    })

    it('should handle UNCHANGED_SENTINEL with no existing match', () => {
      const files = [{ relativePath: '.env', content: UNCHANGED_SENTINEL }]
      const result = encryptLocalFiles(crypto, files)
      expect(result[0].content).toBe(UNCHANGED_SENTINEL)
    })
  })

  describe('decryptLocalFiles', () => {
    it('should decrypt encrypted file content', () => {
      const encrypted = crypto.encrypt('DB_URL=postgres://localhost')
      const files = [{ relativePath: '.env', content: encrypted }]
      const result = decryptLocalFiles(crypto, files)
      expect(result[0].content).toBe('DB_URL=postgres://localhost')
    })

    it('should pass through non-encrypted content', () => {
      const files = [{ relativePath: 'readme.txt', content: 'plain text' }]
      const result = decryptLocalFiles(crypto, files)
      expect(result[0].content).toBe('plain text')
    })
  })

  describe('maskLocalFiles', () => {
    it('should mask encrypted content', () => {
      const encrypted = crypto.encrypt('secret')
      const files = [
        { relativePath: '.env', content: encrypted },
        { relativePath: 'config.json', content: 'not encrypted' },
      ]
      const result = maskLocalFiles(crypto, files)
      expect(result[0].content).toBe(SENSITIVE_VALUE_MASK)
      expect(result[1].content).toBe('not encrypted')
    })
  })
})
