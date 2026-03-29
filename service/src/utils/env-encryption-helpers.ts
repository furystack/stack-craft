import type { EnvironmentVariableValue } from 'common'

import type { CryptoService } from './crypto-service.js'
import { UNCHANGED_SENTINEL } from './crypto-service.js'

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
