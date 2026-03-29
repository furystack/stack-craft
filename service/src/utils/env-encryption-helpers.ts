import type { EnvironmentVariableValue, ServiceFile } from 'common'

import type { CryptoService } from './crypto-service.js'
import { SENSITIVE_VALUE_MASK, UNCHANGED_SENTINEL } from './crypto-service.js'

/**
 * Encrypts `customValue` for entries where `isSensitive` is true.
 * Skips values that are already encrypted or set to the unchanged sentinel.
 * When the sentinel is present, `existingValues` is consulted to preserve the
 * previously stored (encrypted) value.
 */
export const encryptEnvValues = (
  crypto: CryptoService,
  values: Record<string, EnvironmentVariableValue>,
  existingValues?: Record<string, EnvironmentVariableValue>,
): Record<string, EnvironmentVariableValue> => {
  const result: Record<string, EnvironmentVariableValue> = {}
  for (const [key, val] of Object.entries(values)) {
    if (!val.isSensitive || val.source !== 'custom' || val.customValue === undefined) {
      result[key] = val
      continue
    }

    if (val.customValue === UNCHANGED_SENTINEL) {
      result[key] = existingValues?.[key] ?? val
      continue
    }

    if (crypto.isEncrypted(val.customValue)) {
      result[key] = val
      continue
    }

    result[key] = { ...val, customValue: crypto.encrypt(val.customValue) }
  }
  return result
}

/**
 * Decrypts `customValue` for entries where the value is encrypted.
 */
export const decryptEnvValues = (
  crypto: CryptoService,
  values: Record<string, EnvironmentVariableValue>,
): Record<string, EnvironmentVariableValue> => {
  const result: Record<string, EnvironmentVariableValue> = {}
  for (const [key, val] of Object.entries(values)) {
    if (val.customValue && crypto.isEncrypted(val.customValue)) {
      result[key] = { ...val, customValue: crypto.decrypt(val.customValue) }
    } else {
      result[key] = val
    }
  }
  return result
}

/**
 * Replaces encrypted `customValue` entries with a mask for safe API responses.
 */
export const maskSensitiveEnvValues = (
  crypto: CryptoService,
  values: Record<string, EnvironmentVariableValue>,
  mask: string,
): Record<string, EnvironmentVariableValue> => {
  const result: Record<string, EnvironmentVariableValue> = {}
  for (const [key, val] of Object.entries(values)) {
    if (val.customValue && crypto.isEncrypted(val.customValue)) {
      result[key] = { ...val, customValue: mask }
    } else {
      result[key] = val
    }
  }
  return result
}

// --- Local file encryption helpers ---

/**
 * Encrypts the `content` of each local file.
 * Skips already-encrypted content and handles the unchanged sentinel.
 */
export const encryptLocalFiles = (
  crypto: CryptoService,
  files: ServiceFile[],
  existingFiles?: ServiceFile[],
): ServiceFile[] => {
  return files.map((file) => {
    if (file.content === UNCHANGED_SENTINEL) {
      const existing = existingFiles?.find((f) => f.relativePath === file.relativePath)
      return existing ?? file
    }
    if (crypto.isEncrypted(file.content)) {
      return file
    }
    return { ...file, content: crypto.encrypt(file.content) }
  })
}

/**
 * Decrypts the `content` of each local file.
 */
export const decryptLocalFiles = (crypto: CryptoService, files: ServiceFile[]): ServiceFile[] => {
  return files.map((file) => {
    if (crypto.isEncrypted(file.content)) {
      return { ...file, content: crypto.decrypt(file.content) }
    }
    return file
  })
}

/**
 * Replaces encrypted file content with a mask for safe API responses.
 */
export const maskLocalFiles = (crypto: CryptoService, files: ServiceFile[]): ServiceFile[] => {
  return files.map((file) => {
    if (crypto.isEncrypted(file.content)) {
      return { ...file, content: SENSITIVE_VALUE_MASK }
    }
    return file
  })
}
