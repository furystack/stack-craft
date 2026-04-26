import { defineService, type Token } from '@furystack/inject'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32
const ENCRYPTED_PREFIX = 'enc:v1:'

export class CryptoServiceImpl {
  private key: Buffer

  constructor() {
    this.key = this.loadKey()
  }

  private loadKey(): Buffer {
    const envKey = process.env.STACK_CRAFT_ENCRYPTION_KEY
    if (envKey) {
      const decoded = Buffer.from(envKey, 'base64')
      if (decoded.length !== KEY_LENGTH) {
        throw new Error(
          `STACK_CRAFT_ENCRYPTION_KEY must be a base64-encoded 256-bit (32 byte) key, got ${decoded.length} bytes`,
        )
      }
      return decoded
    }

    const keyFilePath = join(homedir(), '.stack-craft', 'encryption.key')
    if (existsSync(keyFilePath)) {
      const contents = readFileSync(keyFilePath, 'utf-8').trim()
      const decoded = Buffer.from(contents, 'base64')
      if (decoded.length !== KEY_LENGTH) {
        throw new Error(
          `Key file ${keyFilePath} must contain a base64-encoded 256-bit key, got ${decoded.length} bytes`,
        )
      }
      return decoded
    }

    const newKey = randomBytes(KEY_LENGTH)
    const keyDir = dirname(keyFilePath)
    mkdirSync(keyDir, { recursive: true })
    writeFileSync(keyFilePath, newKey.toString('base64'), { mode: 0o600 })
    try {
      chmodSync(keyFilePath, 0o600)
    } catch {
      // chmod may fail on some platforms (e.g. Windows); mode is set on write
    }
    return newKey
  }

  public encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH })
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
  }

  public decrypt(token: string): string {
    if (!this.isEncrypted(token)) {
      throw new Error('Value is not in the expected encrypted format')
    }

    const withoutPrefix = token.slice(ENCRYPTED_PREFIX.length)
    const parts = withoutPrefix.split(':')
    if (parts.length < 3) {
      throw new Error('Malformed encrypted value')
    }
    const [ivB64, authTagB64, ...ciphertextParts] = parts
    const ciphertextB64 = ciphertextParts.join(':')
    if (!ivB64 || !authTagB64) {
      throw new Error('Malformed encrypted value')
    }

    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')
    const ciphertext = Buffer.from(ciphertextB64, 'base64')

    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
  }

  public isEncrypted(value: string): boolean {
    return value.startsWith(ENCRYPTED_PREFIX)
  }
}

export type CryptoService = CryptoServiceImpl

export const CryptoService: Token<CryptoService, 'singleton'> = defineService({
  name: 'app/CryptoService',
  lifetime: 'singleton',
  factory: () => new CryptoServiceImpl(),
})

export const SENSITIVE_VALUE_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
export const UNCHANGED_SENTINEL = '__UNCHANGED__'
