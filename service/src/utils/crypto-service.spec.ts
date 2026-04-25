import { randomBytes } from 'crypto'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CryptoServiceImpl, SENSITIVE_VALUE_MASK, UNCHANGED_SENTINEL } from './crypto-service.js'

type CryptoService = CryptoServiceImpl

describe('CryptoService', () => {
  let originalEnv: string | undefined
  let tempKeyDir: string

  beforeEach(() => {
    originalEnv = process.env.STACK_CRAFT_ENCRYPTION_KEY
    tempKeyDir = join(tmpdir(), `stack-craft-test-${Date.now()}`)
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STACK_CRAFT_ENCRYPTION_KEY = originalEnv
    } else {
      delete process.env.STACK_CRAFT_ENCRYPTION_KEY
    }
    if (existsSync(tempKeyDir)) {
      rmSync(tempKeyDir, { recursive: true })
    }
  })

  const createServiceWithEnvKey = (): CryptoService => {
    const key = randomBytes(32)
    process.env.STACK_CRAFT_ENCRYPTION_KEY = key.toString('base64')
    return new CryptoServiceImpl()
  }

  describe('encrypt and decrypt', () => {
    it('should round-trip a plain text value', () => {
      const service = createServiceWithEnvKey()
      const plaintext = 'my-secret-value-123'
      const encrypted = service.encrypt(plaintext)
      expect(encrypted).not.toBe(plaintext)
      expect(service.decrypt(encrypted)).toBe(plaintext)
    })

    it('should handle empty strings', () => {
      const service = createServiceWithEnvKey()
      const encrypted = service.encrypt('')
      expect(service.decrypt(encrypted)).toBe('')
    })

    it('should handle unicode content', () => {
      const service = createServiceWithEnvKey()
      const plaintext = 'Héllo wörld! 🔐'
      expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext)
    })

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const service = createServiceWithEnvKey()
      const plaintext = 'same-value'
      const enc1 = service.encrypt(plaintext)
      const enc2 = service.encrypt(plaintext)
      expect(enc1).not.toBe(enc2)
      expect(service.decrypt(enc1)).toBe(plaintext)
      expect(service.decrypt(enc2)).toBe(plaintext)
    })
  })

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const service = createServiceWithEnvKey()
      const encrypted = service.encrypt('test')
      expect(service.isEncrypted(encrypted)).toBe(true)
    })

    it('should return false for plain text', () => {
      const service = createServiceWithEnvKey()
      expect(service.isEncrypted('just-a-normal-string')).toBe(false)
      expect(service.isEncrypted('')).toBe(false)
      expect(service.isEncrypted('enc:')).toBe(false)
    })
  })

  describe('decryption with wrong key', () => {
    it('should throw when decrypting with a different key', () => {
      const key1 = randomBytes(32)
      const key2 = randomBytes(32)

      process.env.STACK_CRAFT_ENCRYPTION_KEY = key1.toString('base64')
      const service1 = new CryptoServiceImpl()
      const encrypted = service1.encrypt('secret')

      process.env.STACK_CRAFT_ENCRYPTION_KEY = key2.toString('base64')
      const service2 = new CryptoServiceImpl()
      expect(() => service2.decrypt(encrypted)).toThrow()
    })
  })

  describe('decrypt validation', () => {
    it('should throw for non-encrypted values', () => {
      const service = createServiceWithEnvKey()
      expect(() => service.decrypt('not-encrypted')).toThrow('not in the expected encrypted format')
    })

    it('should throw for malformed encrypted values', () => {
      const service = createServiceWithEnvKey()
      expect(() => service.decrypt('enc:v1:')).toThrow('Malformed encrypted value')
    })
  })

  describe('key sources', () => {
    it('should reject env key with wrong size', () => {
      process.env.STACK_CRAFT_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64')
      expect(() => new CryptoServiceImpl()).toThrow('256-bit')
    })
  })

  describe('exports', () => {
    it('should export SENSITIVE_VALUE_MASK', () => {
      expect(SENSITIVE_VALUE_MASK).toBeDefined()
      expect(SENSITIVE_VALUE_MASK.length).toBeGreaterThan(0)
    })

    it('should export UNCHANGED_SENTINEL', () => {
      expect(UNCHANGED_SENTINEL).toBe('__UNCHANGED__')
    })
  })
})
